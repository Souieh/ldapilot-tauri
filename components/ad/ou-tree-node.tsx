'use client';

import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { ADOU } from '@/lib/types/config';
import { cn } from '@/lib/utils';

interface TreeNodeProps {
  ou: ADOU;
  selected: boolean;
  onSelect: (ouDN: string, ou: ADOU) => void;
  level: number;
  expanded: boolean;
  onToggleExpand: (ouDN: string) => void;
  onCreateChild: (parentOuDN: string) => void;
  onDelete: (ouDN: string, ouName: string) => void;
  childOus?: ADOU[];
  isLoading?: boolean;
}

export function OUTreeNode({
  ou,
  selected,
  onSelect,
  level,
  expanded,
  onToggleExpand,
  onCreateChild,
  onDelete,
  childOus = [],
  isLoading,
}: TreeNodeProps) {
  const paddingLeft = `${level * 16}px`;
  const childCount = childOus.length;
  const canDelete = childCount === 0;

  return (
    <div>
      <div
        onClick={() => {
          onSelect(ou.dn, ou);
          onToggleExpand(ou.dn);
        }}
        style={{ paddingLeft }}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors cursor-pointer',
          'hover:bg-muted text-foreground',
          selected && 'bg-primary text-primary-foreground hover:bg-primary'
        )}
      >
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(ou.dn);
            }}
            className="p-0 hover:bg-muted/50 rounded"
            disabled={isLoading || childCount === 0}
          >
            {childCount > 0 ? (
              expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="inline-block h-4 w-4" />
            )}
          </button>
        </div>

        {selected ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0" />
        )}

        <span className="truncate flex-1 text-left">{ou.ou}</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(ou.dn);
            }}
            className="p-1 rounded hover:bg-muted/50"
            disabled={isLoading}
            aria-label={`Create child OU under ${ou.ou}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(ou.dn, ou.ou);
            }}
            className="p-1 rounded hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading || !canDelete}
            aria-label={`Delete OU ${ou.ou}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
