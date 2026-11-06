"use client";

import { useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, X } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

interface StoreClosedModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableFrom: string;
  availableTo: string;
}

export function StoreClosedModal({
  isOpen,
  onClose,
  availableFrom,
  availableTo,
}: StoreClosedModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Toko sedang tutup"
        >
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 text-center shadow-2xl"
          >
            {}
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
              <Clock className="h-8 w-8 text-primary" />
            </div>

            {}
            <h2 className="mt-5 font-display text-xl font-bold text-foreground">
              Toko Sedang Tutup
            </h2>

            {}
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Makanan ini belum tersedia saat ini. Kembali lagi{" "}
              <span className="font-semibold text-foreground">
                besok di jam {availableFrom} - {availableTo}
              </span>{" "}
              untuk menikmatinya.
            </p>

            {}
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-primary-dark active:scale-[0.98]"
            >
              Mengerti
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
