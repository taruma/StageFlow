/**
 * Categorized "+ Add property" popover menu backed by `scoreSchema.ts`.
 * Exposes all valid unauthored keys for any YAML block with inline descriptions.
 */

import React, { useState, useRef, useEffect } from 'react';
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
    const rootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!isOpen) return;
      const handleDown = (e: PointerEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setIsOpen(false);
        }
      };
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setIsOpen(false);
      };
      document.addEventListener('pointerdown', handleDown);
      document.addEventListener('keydown', handleKey);
      return () => {
        document.removeEventListener('pointerdown', handleDown);
        document.removeEventListener('keydown', handleKey);
      };
    }, [isOpen]);

    if (disabled) return null;

    const available = getAvailableAddFields(section, authoredRawKeys);
    if (available.length === 0) return null;
    const groups = groupFieldsByCategory(available);

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
      <div ref={rootRef} className="relative inline-block">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-subtle hover:bg-surface-hover border border-border-main text-[10px] font-mono text-text-muted hover:text-text-main cursor-pointer transition-colors"
        >
          <Plus className="w-2.5 h-2.5" />
          <span>{label.replace(/^\+\s*/, '')}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 z-40 w-64 max-h-64 overflow-y-auto custom-scrollbar rounded-xl bg-surface border border-border-main shadow-xl p-1.5">
            {groups.map((grp) => (
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
            ))}
          </div>
        )}
      </div>
    );
  }
);
