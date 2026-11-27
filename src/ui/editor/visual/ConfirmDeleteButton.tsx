/**
 * Two-click inline delete button for the Visual Score Editor.
 * First click arms a brief `Del?` confirmation pill (~2.6s auto-reset);
 * second click commits removal, preventing accidental single-click deletions.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, X } from 'lucide-react';

export interface ConfirmDeleteButtonProps {
  onConfirm: () => void;
  title: string;
  ariaLabel?: string;
  icon?: 'x' | 'trash';
  revealOnGroupHover?: boolean;
  confirmLabel?: string;
}

export const ConfirmDeleteButton: React.FC<ConfirmDeleteButtonProps> =
  React.memo(
    ({
      onConfirm,
      title,
      ariaLabel,
      icon = 'x',
      revealOnGroupHover = false,
      confirmLabel = 'Del?',
    }) => {
      const [armed, setArmed] = useState(false);
      const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      const clearTimer = useCallback(() => {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }, []);

      useEffect(() => clearTimer, [clearTimer]);

      const disarm = useCallback(() => {
        clearTimer();
        setArmed(false);
      }, [clearTimer]);

      const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (!armed) {
          setArmed(true);
          clearTimer();
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setArmed(false);
          }, 2600);
          return;
        }
        clearTimer();
        setArmed(false);
        onConfirm();
      };

      if (armed) {
        return (
          <button
            type="button"
            onClick={handleClick}
            onBlur={disarm}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                disarm();
              }
            }}
            title={`Click again to confirm: ${title}`}
            aria-label={`Confirm ${ariaLabel ?? title}`}
            className="px-1.5 py-0.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/50 text-[9px] font-mono font-bold text-rose-600 dark:text-rose-300 cursor-pointer shrink-0 leading-none transition-colors"
          >
            {confirmLabel}
          </button>
        );
      }

      const Icon = icon === 'trash' ? Trash2 : X;
      return (
        <button
          type="button"
          onClick={handleClick}
          title={title}
          aria-label={ariaLabel ?? title}
          className={`${
            revealOnGroupHover
              ? 'opacity-0 group-hover:opacity-100 focus:opacity-100'
              : 'opacity-70 hover:opacity-100'
          } p-0.5 rounded text-text-faint hover:text-rose-500 transition-opacity cursor-pointer shrink-0`}
        >
          <Icon className="w-3 h-3" />
        </button>
      );
    }
  );
