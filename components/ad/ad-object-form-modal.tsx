'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { ADUserForm } from '@/components/ad/ad-user-form';
import { ADGroupForm } from '@/components/ad/ad-group-form';
import { UI_LABELS } from '@/lib/constants/ui-labels';

interface ADObjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'user' | 'group' | null;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  initialValues?: Record<string, any>;
}

const defaultValues = {
    displayName: '', cn: '', sAMAccountName: '', mail: '',
    telephoneNumber: '', title: '', department: '', description: '',
};

export function ADObjectFormModal({ isOpen, onClose, type, onSubmit, initialValues }: ADObjectFormModalProps) {
  const [values, setValues] = useState<Record<string, any>>(defaultValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues || defaultValues);
    }
  }, [isOpen, initialValues]);

  const handleChange = (field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (formValues: Record<string, any>) => {
    setIsSubmitting(true);
    await onSubmit(formValues);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'group' ? UI_LABELS.ad.addGroup : UI_LABELS.ad.addUser}
      size="lg"
      
    >
      {type === 'user' ? (
        <ADUserForm values={values} onChange={handleChange} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      ) : (
        <ADGroupForm values={values} onChange={handleChange} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      )}
    </Modal>
  );
}