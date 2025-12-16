"use client";

import { useEffect, useRef } from "react";
import { useModalAnimation } from "@/hooks/useModalAnimation";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmModalProps) {
  const { visible, shouldRender } = useModalAnimation(isOpen);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button and handle escape
  useEffect(() => {
    if (!isOpen) return;

    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!shouldRender) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className={`relative bg-plex-gray border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-xl transition-all duration-200 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      >
        <h2 id="confirm-title" className="text-lg font-medium text-foreground mb-2">
          {title}
        </h2>
        <p id="confirm-message" className="text-sm text-foreground/60 mb-6">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-foreground/60 hover:text-foreground hover:border-white/20 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              destructive
                ? "bg-red-500/80 text-white hover:bg-red-500"
                : "bg-plex-orange text-black hover:bg-amber-500"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
