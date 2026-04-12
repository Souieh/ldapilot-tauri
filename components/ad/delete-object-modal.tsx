'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface DeleteObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  dn: string;
  name: string;
  type: string;
  onSuccess: () => Promise<void>;
}

export function DeleteObjectModal({ isOpen, onClose, dn, name, type, onSuccess }: DeleteObjectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmName, setConfirmName] = useState('');

  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      const password = sessionStorage.getItem('ldap-password') || '';
      const res = await fetch('/api/ldap/objects', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'x-ldap-password': password 
        },
        body: JSON.stringify({ dn, type }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to delete ${type}`);
      }

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
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
      title={`Delete ${type.charAt(0).toUpperCase() + type.slice(1)}`}
      description={`Are you sure you want to delete "${name}"?`}
      size="md"
      actions={[
        {
          label: isSubmitting ? 'Deleting...' : 'Delete Object',
          onClick: handleDelete,
          variant: 'destructive',
          disabled: isSubmitting || confirmName !== name,
        },
      ]}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive/80">
            This action is permanent and will remove the {type} from the Active Directory.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm">
            To confirm, type <span className="font-bold select-all">{name}</span> below:
          </p>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="Type name to confirm"
            className="border-destructive/50 focus-visible:ring-destructive"
          />
        </div>
      </div>
    </Modal>
  );
}