'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { ADOU } from '@/lib/types/config';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { ldapUpdate } from '@/lib/backend-api';

interface BulkMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: any[];
  ous: ADOU[];
  onSuccess: () => Promise<void> | void;
}

export function BulkMoveModal({ isOpen, onClose, selectedItems, ous, onSuccess }: BulkMoveModalProps) {
  const [newOU, setNewOU] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ total: number; current: number }>({ total: 0, current: 0 });

  const handleBulkMove = async () => {
    if (!newOU || selectedItems.length === 0) return;

    try {
      setIsSubmitting(true);
      const password = sessionStorage.getItem('ldap-password') || '';
      let successCount = 0;
      let errorCount = 0;

      setProgress({ total: selectedItems.length, current: 0 });

      for (const item of selectedItems) {
        try {
          await ldapUpdate(item.dn, 'move', { newOU });
          successCount++;
        } catch (err) {
          errorCount++;
        }
        setProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }

      if (successCount > 0) {
        toast.success(`Successfully moved ${successCount} objects`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to move ${errorCount} objects`);
      }

      await onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Bulk move operation failed');
    } finally {
      setIsSubmitting(false);
      setProgress({ total: 0, current: 0 });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Move Objects"
      description={`Move ${selectedItems.length} selected objects to a new destination.`}
      actions={[
        {
          label: isSubmitting ? `Moving (${progress.current}/${progress.total})...` : 'Move Objects',
          onClick: handleBulkMove,
          disabled: isSubmitting || !newOU || selectedItems.length === 0
        }
      ]}
    >
      <div className="space-y-4 py-4">
        {isSubmitting && (
          <div className='flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg text-primary'>
            <Loader2 className='h-5 w-5 animate-spin' />
            <div className='flex-1'>
              <p className='text-sm font-medium'>Processing bulk move...</p>
              <div className='w-full bg-primary/10 h-1.5 mt-2 rounded-full overflow-hidden'>
                <div
                  className='bg-primary h-full transition-all duration-300'
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Destination OU</label>
          <Select onValueChange={setNewOU} value={newOU} disabled={isSubmitting}>
            <SelectTrigger>
              <SelectValue placeholder="Select target OU..." />
            </SelectTrigger>
            <SelectContent>
              {ous.map((ou) => (
                <SelectItem key={ou.dn} value={ou.dn}>
                  {ou.ou || ou.dn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='max-h-[200px] overflow-y-auto border rounded-md p-2 bg-muted/20'>
            <p className='text-[10px] font-bold text-muted-foreground uppercase mb-2'>Objects to move:</p>
            <div className='space-y-1'>
                {selectedItems.map(item => (
                    <div key={item.dn} className='text-xs truncate text-muted-foreground bg-background p-1 border rounded'>
                        {item.displayName || item.cn}
                    </div>
                ))}
            </div>
        </div>
      </div>
    </Modal>
  );
}
