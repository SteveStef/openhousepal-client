import { useEffect } from 'react';

// Freezes the page behind a modal while `active`. Ref-counted so stacked modals (e.g. the
// Documents window with a PDF preview open over it) don't unlock the page when only the top one
// closes. Locks <html> as well as <body> since the document element is the page's scroller.
let lockCount = 0;
let saved: { html: string; body: string } | null = null;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    if (lockCount === 0) {
      saved = { html: document.documentElement.style.overflow, body: document.body.style.overflow };
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0 && saved) {
        document.documentElement.style.overflow = saved.html;
        document.body.style.overflow = saved.body;
        saved = null;
      }
    };
  }, [active]);
}
