import React, { useEffect, useMemo, useRef, useState } from 'react';

function normalizeItems(items) {
  return Array.isArray(items) ? items : [];
}

export default function FloatingDropdown({
  trigger,
  items = [],
  align = 'right',
  className = '',
  menuClassName = '',
  itemClassName = '',
  triggerAriaLabel,
  open: controlledOpen,
  onOpenChange,
  closeOnSelect = true,
}) {
  const rootRef = useRef(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const dropdownClassName = useMemo(() => {
    const base = ['floating-dropdown'];

    if (align === 'left') {
      base.push('floating-dropdown--align-left');
    }

    if (className) {
      base.push(className);
    }

    return base.join(' ');
  }, [align, className]);

  const setOpen = nextOpen => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    if (onOpenChange) {
      onOpenChange(nextOpen);
    }
  };

  useEffect(() => {
    const handlePointerDown = event => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isControlled, onOpenChange]);

  const handleItemClick = item => {
    if (item.disabled) {
      return;
    }

    if (item.onClick) {
      item.onClick();
    }

    if (closeOnSelect) {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={dropdownClassName} data-open={isOpen ? 'true' : 'false'}>
      <button
        type="button"
        className="floating-dropdown__trigger"
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
      >
        {trigger}
        <span className="floating-dropdown__chevron" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className={`floating-dropdown__menu ${menuClassName}`.trim()} role="menu">
          {normalizeItems(items).map((item, index) => {
            if (item?.type === 'separator') {
              return <div key={`separator-${index}`} className="floating-dropdown__separator" role="separator" />;
            }

            const content = item?.label ?? item?.children ?? '';
            const sharedProps = {
              className: `${itemClassName ? `${itemClassName} ` : ''}${item?.className ? `${item.className} ` : ''}floating-dropdown__item`.trim(),
              role: 'menuitem',
            };

            if (item?.href) {
              return (
                <a key={item.id ?? `${content}-${index}`} href={item.href} {...sharedProps} onClick={item.onClick}>
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item?.id ?? `${content}-${index}`}
                type="button"
                disabled={item?.disabled}
                {...sharedProps}
                onClick={() => handleItemClick(item || {})}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}