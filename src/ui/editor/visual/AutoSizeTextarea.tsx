/**
 * Auto-growing multi-line textarea control for prose YAML fields (`description`,
 * `subtitle`, `note`, metadata notes, and any multi-line string).
 */

import React, { useRef, useLayoutEffect } from 'react';
import { UI_TOKENS } from '../../tokens/ui';

export interface AutoSizeTextareaProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  maxHeightPx?: number;
  ariaLabel?: string;
  className?: string;
  onChange: (nextValue: string) => void;
  onCommit: () => void;
  onCancel?: () => void;
}

export const AutoSizeTextarea: React.FC<AutoSizeTextareaProps> = React.memo(
  ({
    value,
    placeholder,
    disabled = false,
    minRows = 2,
    maxHeightPx = 180,
    ariaLabel,
    className = '',
    onChange,
    onCommit,
    onCancel,
  }) => {
    const ref = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxHeightPx)}px`;
    }, [value, maxHeightPx]);

    return (
      <textarea
        ref={ref}
        data-native-undo="true"
        rows={minRows}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            onCommit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel?.();
            e.currentTarget.blur();
          }
        }}
        className={`w-full resize-none leading-snug py-1 overflow-y-auto custom-scrollbar ${UI_TOKENS.inspector.textInput} ${className}`}
      />
    );
  }
);
