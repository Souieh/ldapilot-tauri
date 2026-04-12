'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Trash2, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ManageGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectDN: string;
  objectName: string;
  memberOf?: string | string[];
  onSuccess: () => Promise<void>;
}

export function ManageGroupsModal({
  isOpen,
  onClose,
  objectDN,
  objectName,
  memberOf = [],
  onSuccess,
}: ManageGroupsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Normalize memberOf to an array
  const memberships = Array.isArray(memberOf) ? memberOf : memberOf ? [memberOf] : [];

  const handleRemoveMember = async (groupDN: string) => {
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/ldap/objects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-member',
          payload: {
            groupDN,
            memberDN: objectDN,
            type: 'delete',
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove group membership');
      }

      toast.success('Removed from group');
      await onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Groups: ${objectName}`}
      description="View and manage the groups this object belongs to."
      size="md"
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Current Memberships ({memberships.length})
          </h4>
          <div className="max-h-[300px] overflow-y-auto border rounded-md bg-muted/30">
            {memberships.length > 0 ? (
              <div className="p-2 space-y-1">
                {memberships.map((groupDN) => {
                  const groupName = groupDN.split(',')[0].replace(/^CN=/i, '');
                  return (
                    <div key={groupDN} className="flex items-center justify-between gap-3 p-2 bg-background border rounded-md group">
                      <div className="flex items-center gap-2 min-w-0">
                        <Shield className="h-4 w-4 text-primary shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-medium truncate">{groupName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{groupDN}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveMember(groupDN)} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground italic text-sm">
                No direct memberships found.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}