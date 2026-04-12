'use client';

import { Modal } from '@/components/ui/modal';
import { ADUserDetails } from '@/components/ad/ad-user-details';
import { ADComputerDetails } from '@/components/ad/ad-computer-details';
import { ADGroupDetails } from '@/components/ad/ad-group-details';

interface ADObjectDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
}

export function ADObjectDetailModal({ isOpen, onClose, item }: ADObjectDetailModalProps) {
  if (!item) return null;

  const isGroup = item.member !== undefined;
  const isComputer = item.dNSHostName !== undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${item.displayName || item.cn || 'Object'} Details`}
      size="lg"
    >
      <div className="space-y-4">
        {isGroup ? (
          <ADGroupDetails group={item} />
        ) : isComputer ? (
          <ADComputerDetails computer={item} />
        ) : (
          <ADUserDetails user={item} />
        )}
      </div>
    </Modal>
  );
}