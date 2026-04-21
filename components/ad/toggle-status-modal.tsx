'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { AlertCircle, UserCheck, UserX } from 'lucide-react';
import { ldapUpdate } from '@/lib/backend-api';

interface ToggleStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  dn: string;
  name: string;
  enabled: boolean;
  type: string;
  onSuccess: () => Promise<void>;
}

export function ToggleStatusModal({
  isOpen,
  onClose,
  dn,
  name,
  enabled,
  type,
  onSuccess,
}: ToggleStatusModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggle = async () => {
    try {
      setIsSubmitting(true);
      await ldapUpdate(dn, 'toggle-status', { enabled: !enabled });

      toast.success(`${type} ${enabled ? 'disabled' : 'enabled'} successfully`);
      await onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionLabel = enabled ? 'Disable' : 'Enable';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${actionLabel} ${type}`}
      description={`Are you sure you want to ${actionLabel.toLowerCase()} "${name}"?`}
      size="md"
      actions={[
        {
          label: isSubmitting ? `${enabled ? 'Disabling...' : 'Enabling...'}` : `${actionLabel} ${type}`,
          onClick: handleToggle,
          variant: enabled ? 'destructive' : 'default',
          disabled: isSubmitting,
        },
      ]}
    >
      <div className="space-y-4">
        <div className={`flex items-start gap-3 p-4 rounded-md border ${
          enabled
            ? 'bg-destructive/10 border-destructive/20'
            : 'bg-green-50 border-green-200'
        }`}>
          {enabled ? (
            <UserX className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <UserCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className={`text-sm font-medium ${enabled ? 'text-destructive' : 'text-green-800'}`}>
              Account Status Change
            </p>
            <p className={`text-sm ${enabled ? 'text-destructive/80' : 'text-green-700'}`}>
              {enabled
                ? `Disabling this ${type.toLowerCase()} will prevent them from logging in and accessing resources.`
                : `Enabling this ${type.toLowerCase()} will allow them to log in and access resources again.`}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-muted/50 border border-border rounded-md">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            This will update the <code className="text-xs bg-muted px-1 py-0.5 rounded">userAccountControl</code> attribute in Active Directory.
          </p>
        </div>
      </div>
    </Modal>
  );
}
