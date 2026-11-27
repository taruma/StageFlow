/**
 * Compact `(?)` info popover on YAML field rows showing detailed explanation,
 * valid constraints/options, defaults, and accepted aliases.
 */

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { HelpCircle } from 'lucide-react';
import type { FieldDescriptor } from '../../../core/schema/scoreSchemaTypes';
import { UI_TOKENS } from '../../tokens/ui';

export interface FieldInfoPopoverProps {
  yamlKey: string;
  descriptor: FieldDescriptor | null;
}

export const FieldInfoPopover: React.FC<FieldInfoPopoverProps> = React.memo(
  ({ yamlKey, descriptor }) => {
    const [open, setOpen] = useState(false);

    const explanation = descriptor
      ? descriptor.description ?? descriptor.hint
      : `Unregistered custom YAML key "${yamlKey}". Preserved verbatim in the score document without schema constraints.`;

    const rangeLabel =
      descriptor &&
      (descriptor.min !== undefined || descriptor.max !== undefined)
        ? `${descriptor.min ?? '−∞'} to ${descriptor.max ?? '+∞'}${
            descriptor.unit ? ` ${descriptor.unit}` : ''
          }`
        : null;

    const defaultStr =
      descriptor &&
      descriptor.defaultOnAdd !== undefined &&
      descriptor.defaultOnAdd !== ''
        ? Array.isArray(descriptor.defaultOnAdd)
          ? `[${descriptor.defaultOnAdd.join(', ')}]`
          : String(descriptor.defaultOnAdd)
        : null;

    return (
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Explain ${yamlKey}`}
            title={`Details for ${yamlKey}`}
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-text-faint/55 group-hover:text-text-muted hover:text-text-main data-[state=open]:text-amber-500 transition-colors cursor-pointer shrink-0"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </Popover.Trigger>

        {open && (
          <Popover.Portal>
            <Popover.Content
              side="right"
              align="start"
              sideOffset={8}
              collisionPadding={10}
              onClick={(e) => e.stopPropagation()}
              className={`${UI_TOKENS.inspector.portalMenu} w-64 p-2.5 space-y-2 select-text`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-text-main truncate">
                    {descriptor ? descriptor.label : yamlKey}
                  </span>
                  <code className="px-1 py-0 rounded bg-surface-subtle border border-border-subtle text-[9px] font-mono text-text-muted shrink-0">
                    {yamlKey}
                  </code>
                </div>
                {descriptor?.required && (
                  <span className="px-1 py-0 rounded bg-amber-500/15 border border-amber-500/40 text-[9px] font-mono text-amber-600 dark:text-amber-300 shrink-0">
                    required
                  </span>
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-text-body">
                {explanation}
              </p>

              {descriptor && (
                <div className="space-y-1 pt-1 border-t border-border-subtle text-[10px]">
                  <div className="flex items-center justify-between gap-2 text-text-muted">
                    <span>Type</span>
                    <code className="font-mono text-text-main">
                      {descriptor.kind}
                      {descriptor.unit ? ` (${descriptor.unit})` : ''}
                    </code>
                  </div>

                  {rangeLabel && (
                    <div className="flex items-center justify-between gap-2 text-text-muted">
                      <span>Range</span>
                      <code className="font-mono text-text-main">
                        {rangeLabel}
                      </code>
                    </div>
                  )}

                  {defaultStr !== null && (
                    <div className="flex items-center justify-between gap-2 text-text-muted">
                      <span>Default</span>
                      <code className="font-mono text-text-main">
                        {defaultStr}
                      </code>
                    </div>
                  )}

                  {descriptor.options && descriptor.options.length > 0 && (
                    <div className="space-y-1 pt-0.5">
                      <span className="text-text-muted block">Options</span>
                      <div className="flex flex-wrap gap-1">
                        {descriptor.options.map((opt) => (
                          <code
                            key={opt}
                            className="px-1 py-0 rounded bg-surface-subtle border border-border-subtle font-mono text-[9px] text-text-main"
                          >
                            {opt}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  {descriptor.aliases && descriptor.aliases.length > 0 && (
                    <div className="flex items-start justify-between gap-2 text-text-muted pt-0.5">
                      <span className="shrink-0">Aliases</span>
                      <span className="font-mono text-[9px] text-text-faint text-right break-all">
                        {descriptor.aliases.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        )}
      </Popover.Root>
    );
  }
);
