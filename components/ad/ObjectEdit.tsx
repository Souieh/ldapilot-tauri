'use client';

import { ADGroupForm } from '@/components/ad/ad-group-form';
import { ADUserForm } from '@/components/ad/ad-user-form';
import { Modal } from '@/components/ui/modal';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface ObjectEditProps {
  item: any;
  onSuccess?: () => void;
}

interface ObjectEditModalProps extends ObjectEditProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ObjectEdit({ item, onSuccess }: ObjectEditProps) {
  const [values, setValues] = useState<Record<string, any>>(item || {});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setValues(item);
    }
  }, [item]);

  if (!item) return null;

  const isGroup = item.objectClass?.includes('group');
  const isComputer = item.objectClass?.includes('computer');
  const isUser = item.objectClass?.includes('user') && !isComputer;

  const handleChange = (field: string, value: any) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (formValues: Record<string, any>) => {
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/ldap/objects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dn: item.dn,
          action: 'update',
          payload: {
            attributes: formValues,
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update object');
      }

      toast.success('Object updated successfully');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error updating object');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4 py-2'>
      {isUser ? (
        <ADUserForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isEditMode={true}
        />
      ) : isGroup ? (
        <ADGroupForm
          values={values}
          onChange={handleChange}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          isEditMode={true}
        />
      ) : (
        <div className='p-8 text-center border rounded-lg bg-muted/20'>
          <p className='text-muted-foreground italic'>
            Editing is not yet supported for this object type.
          </p>
        </div>
      )}
    </div>
  );
}

export function ObjectEditModal({
  isOpen,
  onClose,
  item,
  onSuccess,
}: ObjectEditModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit: ${item?.displayName || item?.cn || 'Object'}`}
      description='Update Active Directory object properties'
      size='lg'
    >
      <ObjectEdit
        item={item}
        onSuccess={() => {
          if (onSuccess) onSuccess();
          onClose();
        }}
      />
    </Modal>
  );
}
