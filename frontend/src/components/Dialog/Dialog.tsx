import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Dialog.module.css';

interface DialogProps {
  title: string;
  busy?: boolean;
  children: ReactNode;
  onClose(): void;
}

export default function Dialog({ title, busy = false, children, onClose }: DialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const backdropClickAllowed = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    dialogRef.current?.focus();
    return () => {
      if (root) root.inert = wasInert;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div
      className={styles.backdrop}
      onPointerDownCapture={(event) => {
        backdropClickAllowed.current = event.target === event.currentTarget
          && event.isPrimary && event.button === 0;
      }}
      onPointerUpCapture={(event) => {
        backdropClickAllowed.current = backdropClickAllowed.current
          && event.target === event.currentTarget;
      }}
      onPointerCancel={() => { backdropClickAllowed.current = false; }}
      onClick={(event) => {
        const allowed = backdropClickAllowed.current;
        backdropClickAllowed.current = false;
        if (allowed && event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (!busy) onClose();
          }
          if (event.key !== 'Tab') return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ));
          const first = controls[0];
          const last = controls.at(-1);
          if (!first) {
            event.preventDefault();
          } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button type="button" aria-label="닫기" disabled={busy} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
