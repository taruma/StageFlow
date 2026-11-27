/**
 * Theme-native headless dropdown backed by `@radix-ui/react-select` and `UI_TOKENS.inspector`.
 * Portals cleanly above scroll containers and inherits all 4 StageFlow themes automatically.
 */

import React, { useMemo } from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { UI_TOKENS } from '../../tokens/ui';

export interface InspectorSelectOption {
  value: string;
  label: string;
}

export interface InspectorSelectProps {
  value: string;
  options: readonly InspectorSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  maxWidthClassName?: string;
  ariaLabel?: string;
  onValueChange: (nextValue: string) => void;
}

export const InspectorSelect: React.FC<InspectorSelectProps> = React.memo(
  ({
    value,
    options,
    disabled = false,
    placeholder = 'Select…',
    maxWidthClassName = '',
    ariaLabel,
    onValueChange,
  }) => {
    const validOptions = useMemo(
      () => options.filter((opt) => opt.value !== ''),
      [options]
    );
    const normalizedValue = value === '' ? undefined : value;

    return (
      <Select.Root
        value={normalizedValue}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <Select.Trigger
          aria-label={ariaLabel}
          className={`${UI_TOKENS.inspector.selectTrigger} ${maxWidthClassName}`}
        >
          <span className="truncate">
            <Select.Value placeholder={placeholder} />
          </span>
          <Select.Icon className="text-text-muted shrink-0">
            <ChevronDown className="w-3 h-3" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            collisionPadding={8}
            className={`${UI_TOKENS.inspector.portalMenu} min-w-[var(--radix-select-trigger-width)] max-w-[260px]`}
          >
            <Select.Viewport className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5">
              {validOptions.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[11px] font-mono text-text-body data-[highlighted]:bg-surface-subtle data-[highlighted]:text-text-main data-[state=checked]:text-amber-600 dark:data-[state=checked]:text-amber-300 data-[state=checked]:font-semibold outline-none cursor-pointer transition-colors"
                >
                  <Select.ItemText>{opt.label}</Select.ItemText>
                  <Select.ItemIndicator className="text-amber-500 shrink-0">
                    <Check className="w-3 h-3" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    );
  }
);
