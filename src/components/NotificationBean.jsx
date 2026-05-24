import React, { useEffect, useState } from 'react';

const VARIANT_LABELS = {
  success: 'Success',
  error: 'Error',
};

export default function NotificationBean({ type = 'error', message }) {
  const [isVisible, setIsVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setIsVisible(false);
      return undefined;
    }

    setIsVisible(true);

    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message]);

  if (!message) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const variantClass = type === 'success' ? 'notification-bean--success' : 'notification-bean--error';

  return (
    <div className={`notification-bean ${variantClass}`} role="status" aria-live="polite">
      <span className="notification-bean__label">{VARIANT_LABELS[type] || VARIANT_LABELS.error}</span>
      <span className="notification-bean__message">{message}</span>
    </div>
  );
}