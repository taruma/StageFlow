/**
 * Categorized "+ Add property" popover menu backed by `scoreSchema.ts` and `@radix-ui/react-popover`.
 * Portals cleanly above scroll containers with automatic viewport collision flipping.
 */

import React, { useState, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus } from 'lucide-react';
import {
  getAvailableAddFields,
  groupFieldsByCategory,
} from '../../../core/scoreSchema';
import type {
  FieldDescriptor,
  SchemaSectionName,
  YamlPath,
} from '../../../core/schema/scoreSchemaTypes';
import type { ScoreYamlCommand } from '../../../core/scoreYamlMutator';
import { UI_TOKENS } from '../../tokens/ui';

export interface AddPropertyPopoverProps {
  section: SchemaSectionName;
  parentPath: YamlPath;
  authoredRawKeys: readonly string[];
  label?: string;
  disabled?: boolean;
  onCommand: (cmd: ScoreYamlCommand) => void;
}

export const AddPropertyPopover: React.FC<AddPropertyPopoverProps> = React.memo(
  ({
    section,
    parentPath,
    authoredRawKeys,
    label = '+ Property',
    disabled = false,
    onCommand,
  }) => {
    const [isOpen, setIsOpen] = useState(false);

    const groups = useMemo(() => {
      if (!isOpen) return [];
      const available = getAvailableAddFields(section, authoredRawKeys);
      return available.length > 0 ? groupFieldsByCategory(available) : [];
    }, [isOpen, section, authoredRawKeys]);

    if (disabled) return null;

    const handleSelect = (field: FieldDescriptor) => {
      onCommand({
        type: 'add-field',
        parentPath,
        key: field.key,
        value: field.defaultOnAdd,
        format: field.formatHint,
      });
      setIsOpen(false);
    };

    return (
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={UI_TOKENS.inspector.addPropBtn}>
            <Plus className="w-2.5 h-2.5" />
            <span>{label.replace(/^\+\s*/, '')}</span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={10}
            className={`${UI_TOKENS.inspector.portalMenu} w-64 max-h-64 overflow-y-auto custom-scrollbar p-1.5`}
          >
            {groups.length === 0 ? (
              <div className="px-2 py-1.5 text-[10px] font-mono text-text-faint text-center">
                All properties authored
              </div>
            ) : (
              groups.map((grp) => (
                <div key={grp.group} className="mb-1.5 last:mb-0">
                  <div className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider text-text-faint">
                    {grp.label}
                  </div>
                  {grp.fields.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => handleSelect(f)}
                      className="w-full text-left px-2 py-1 rounded-lg hover:bg-surface-subtle flex flex-col gap-0.5 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-semibold text-text-main">
                          {f.key}
                        </span>
                        {f.unit && (
                          <span className="text-[9px] font-mono text-text-faint">
                            {f.unit}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted leading-tight">
                        {f.hint}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
