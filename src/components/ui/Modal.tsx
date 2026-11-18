import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Close } from "@/components/Icons";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Hide the default floating close button (panels with their own chrome). */
  hideClose?: boolean;
  label: string;
}

export function Modal({ open, onClose, children, className, hideClose, label }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-ink-950/75 backdrop-blur-[3px] animate-fade-up"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "relative flex max-h-[88vh] w-full animate-fade-up flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-panel",
          className,
        )}
      >
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            className="icon-btn absolute right-3 top-3 z-10"
            aria-label="Close dialog"
          >
            <Close size={14} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
