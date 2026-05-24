import React, { useEffect } from 'react';

export default function FloatingCard({
  open,
  title,
  onClose,
  children,
  closeLabel = 'Back',
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="floating-card-backdrop" role="presentation" style={{ userSelect: 'none' }}>
      <section
        className="floating-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={event => event.stopPropagation()}
      >
        <button type="button" className="floating-card__close" onClick={onClose}>
          {closeLabel}
        </button>

        {title ? <h2 className="floating-card__title">{title}</h2> : null}

        <div className="floating-card__body">{children}</div>
      </section>
    </div>
  );
}