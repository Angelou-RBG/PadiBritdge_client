import React from 'react';
import FloatingCard from './FloatingCard';

export default function DeletePostCard({
  open,
  onClose,
  onConfirm,
  isDeleting = false,
}) {
  return (
    <FloatingCard open={open} title="Delete Post" onClose={onClose}>
      <p>Do you want to remove post?</p>

      <div className="floating-card__actions">
        <button type="button" className="ghost-btn" onClick={onClose} disabled={isDeleting}>
          No
        </button>
        <button type="button" className="danger-btn" onClick={onConfirm} disabled={isDeleting}>
          Yes
        </button>
      </div>
    </FloatingCard>
  );
}