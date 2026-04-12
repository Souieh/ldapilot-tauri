'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Network } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ADOU } from '@/lib/types/config';
import { toast } from 'sonner';

const ILLEGAL_OU_CHARS = /[,\\#+<>;\"=]/;
const MAX_OU_LENGTH = 64;

interface CreateOUModalProps {
  isOpen: boolean;
  onClose: () => void;
  ous: ADOU[];
  parentOuDN: string;
  onSuccess: () => Promise<void>;
}

type TreeData = ADOU & { children: TreeData[] };

const getParentDN = (dn: string) => {
  const parts = dn.match(/(?:\\.|[^,])+/g);
  if (!parts || parts.length <= 1) return '';
  return parts.slice(1).map((part) => part.trim()).join(',');
};

const buildTree = (ous: ADOU[]): TreeData[] => {
  const nodeMap = new Map<string, TreeData>();
  ous.forEach((ou) => nodeMap.set(ou.dn, { ...ou, children: [] }));
  
  const roots: TreeData[] = [];
  nodeMap.forEach((node) => {
    const parentDN = getParentDN(node.dn);
    if (parentDN && nodeMap.has(parentDN)) {
      nodeMap.get(parentDN)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortTree = (nodes: TreeData[]) => {
    nodes.sort((a, b) => a.ou.localeCompare(b.ou));
    nodes.forEach((node) => sortTree(node.children));
  };

  sortTree(roots);
  return roots;
};

export function CreateOUModal({ isOpen, onClose, ous, parentOuDN: initialParentDN, onSuccess }: CreateOUModalProps) {
  const [name, setName] = useState('');
  const [parentDN, setParentDN] = useState(initialParentDN);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([initialParentDN]));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tree = useMemo(() => buildTree(ous), [ous]);

  const toggleExpand = (dn: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expanded);
    if (next.has(dn)) {
      next.delete(dn);
    } else {
      next.add(dn);
    }
    setExpanded(next);
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('OU name is required');
      return;
    }

    if (ILLEGAL_OU_CHARS.test(trimmedName)) {
      toast.error('OU name contains invalid characters: , \\ # + < > ; " =');
      return;
    }

    if (trimmedName.length > MAX_OU_LENGTH) {
      toast.error(`OU name must be ${MAX_OU_LENGTH} characters or less`);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/ldap/ous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentDN: parentDN || undefined, ouName: trimmedName }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create OU');
      }

      toast.success('Organizational unit created');
      await onSuccess();
      onClose();
      setName('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTreeNode = (node: TreeData, level = 0) => {
    const isExpanded = expanded.has(node.dn);
    const isSelected = parentDN === node.dn;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.dn}>
        <div
          onClick={() => setParentDN(node.dn)}
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer transition-colors",
            isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {hasChildren && (
              <button onClick={(e) => toggleExpand(node.dn, e)} className="hover:bg-accent/50 rounded">
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
          </div>
          {isSelected ? (
            <FolderOpen className="h-4 w-4 shrink-0 opacity-90" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.ou}</span>
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-0.5">
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Organizational Unit"
      description="Enter an OU name and parent path to preview the generated DN."
      size="md"
      actions={[{ label: 'Create OU', onClick: handleCreate, disabled: isSubmitting || !name.trim() }]}
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted-foreground">OU Name</label>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="e.g. Sales" 
            maxLength={MAX_OU_LENGTH}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted-foreground">Parent DN</label>
          <div className="border rounded-md bg-background overflow-hidden flex flex-col max-h-[240px]">
            <div 
              onClick={() => setParentDN('')}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b transition-colors",
                parentDN === '' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <Network className="h-4 w-4 shrink-0" />
              <span className="font-medium">Base DN (Root)</span>
            </div>
            <div className="overflow-y-auto p-1">
              {tree.map(node => renderTreeNode(node))}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted p-3">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Preview Generated DN</p>
          <div className="text-xs font-mono break-all text-foreground bg-background p-2 rounded border border-input">
            {name.trim() 
              ? `OU=${name.trim()}${parentDN ? `,${parentDN}` : ''}`
              : 'Enter an OU name...'}
          </div>
        </div>
      </div>
    </Modal>
  );
}