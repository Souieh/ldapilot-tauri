'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface DeleteOUModalProps {
  isOpen: boolean;
  onClose: () => void;
  ouDN: string;
  ouName: string;
  onSuccess: () => Promise<void>;
}

export function DeleteOUModal({ isOpen, onClose, ouDN, ouName, onSuccess }: DeleteOUModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/ldap/ous', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ouDN }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete OU');
      }

      toast.success('Organizational unit deleted');
      await onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
      setConfirmName('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Organizational Unit"
      description={`Are you sure you want to delete "${ouName}"?`}
      size="md"
      actions={[
        {
          label: isSubmitting ? 'Deleting...' : 'Delete OU',
          onClick: handleDelete,
          variant: 'destructive',
          disabled: isSubmitting || confirmName !== ouName,
        },
      ]}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Warning: This action is permanent.</p>
            <p className="text-sm text-destructive/80 leading-relaxed">
              Deleting an OU is only possible if it contains no child objects (users, groups, computers, or sub-OUs). 
              The directory server will reject the request if the container is not empty.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Target Distinguished Name</p>
          <p className="text-xs font-mono p-2 bg-muted rounded border break-all text-muted-foreground">{ouDN}</p>
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-sm">
            To confirm, type <span className="font-bold select-all">{ouName}</span> in the box below:
          </p>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Type OU name to confirm"
            className="border-destructive/50 focus-visible:ring-destructive"
          />
        </div>
      </div>
    </Modal>
  );
}