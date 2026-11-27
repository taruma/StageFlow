/**
 * Schema-driven YAML field row shell.
 * Renders an optional drag handle, YAML key label with tooltip/raw badge,
 * delegated `FieldValueControl`, and hover-revealed remove button.
 */

import React, { useCallback } from 'react';
import { X } from 'lucide-react';
import type { VisualFieldNode } from '../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from './visualEditorTypes';
import { UI_TOKENS } from '../../tokens/ui';
import { FieldValueControl } from './FieldValueControl';

export interface SchemaFieldRowProps {
  field: VisualFieldNode;
  callbacks: VisualEditorCallbacks;
  dragHandle?: React.ReactNode;
}

export const SchemaFieldRow: React.FC<SchemaFieldRowProps> = React.memo(
  ({ field, callbacks, dragHandle }) => {
    const { disabled, onCommand } = callbacks;
    const desc = field.descriptor;

    const handleRemove = useCallback(() => {
      onCommand({ type: 'remove-field', path: field.yamlPath });
    }, [field.yamlPath, onCommand]);

    return (
      <div className={UI_TOKENS.inspector.fieldRow}>
        <div className="flex items-center gap-1 pt-0.5 min-w-0">
          {dragHandle}
          <span
            className="text-[10px] font-mono text-text-muted truncate"
            title={
              desc
                ? `${field.key}: ${desc.hint}`
                : `${field.key} (unregistered custom YAML key)`
            }
          >
            {field.key}
          </span>
          {!desc && (
            <span className="px-1 py-0 rounded text-[8px] font-mono bg-surface-subtle border border-border-subtle text-text-faint">
              raw
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
          <FieldValueControl field={field} callbacks={callbacks} />
          {!disabled && !desc?.required && (
            <button
              type="button"
              onClick={handleRemove}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded text-text-faint hover:text-rose-500 transition-opacity cursor-pointer shrink-0"
              title={`Remove "${field.key}"`}
              aria-label={`Remove ${field.key}`}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }
);
