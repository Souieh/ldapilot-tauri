'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';

interface UpdatePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  dn: string;
  name: string;
  onSuccess: () => Promise<void>;
}

export function UpdatePasswordModal({ isOpen, onClose, dn, name, onSuccess }: UpdatePasswordModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdate = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!newPassword) {
      toast.error('Password cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      const adminPassword = sessionStorage.getItem('ldap-password') || '';
      
      const res = await fetch('/api/ldap/objects', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-ldap-password': adminPassword 
        },
        body: JSON.stringify({ 
          dn, 
          action: 'password', 
          payload: {
            newPassword
          }
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update password');
      }

      toast.success(`Password for ${name} updated successfully`);
      await onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Password"
      description={`Update password for account: ${name}`}
      size="md"
      actions={[
        {
          label: isSubmitting ? 'Updating...' : 'Update Password',
          onClick: handleUpdate,
          disabled: isSubmitting || !newPassword || newPassword !== confirmPassword,
        },
      ]}
    >
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New Password</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="newPassword"
              type="password"
              placeholder="Enter new password"
              className="pl-10"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              className="pl-10"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}