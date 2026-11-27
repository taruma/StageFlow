/**
 * Schema-driven YAML field row shell.
 * Renders an optional drag handle, YAML key label with tooltip/raw badge,
 * delegated `FieldValueControl`, and hover-revealed remove button.
 */

import React, { useCallback } from 'react';
import type { VisualFieldNode } from '../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from './visualEditorTypes';
import { UI_TOKENS } from '../../tokens/ui';
import { ConfirmDeleteButton } from './ConfirmDeleteButton';
import { FieldInfoPopover } from './FieldInfoPopover';
import { FieldValueControl, isMultilineTextField } from './FieldValueControl';

export interface SchemaFieldRowProps {
  field: VisualFieldNode;
  callbacks: VisualEditorCallbacks;
  dragHandle?: React.ReactNode;
}

export const SchemaFieldRow: React.FC<SchemaFieldRowProps> = React.memo(
  ({ field, callbacks, dragHandle }) => {
    const { disabled, onCommand } = callbacks;
    const desc = field.descriptor;
    const multiline = isMultilineTextField(field);

    const handleRemove = useCallback(() => {
      onCommand({ type: 'remove-field', path: field.yamlPath });
    }, [field.yamlPath, onCommand]);

    const keyLabel = (
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
        <FieldInfoPopover yamlKey={field.key} descriptor={desc} />
        {!desc && (
          <span className="px-1 py-0 rounded text-[8px] font-mono bg-surface-subtle border border-border-subtle text-text-faint shrink-0">
            raw
          </span>
        )}
      </div>
    );

    const removeButton = !disabled && !desc?.required && (
      <ConfirmDeleteButton
        onConfirm={handleRemove}
        title={`Remove "${field.key}"`}
        ariaLabel={`Remove ${field.key}`}
        revealOnGroupHover
      />
    );

    if (multiline) {
      return (
        <div className="group flex flex-col gap-1 py-1.5 px-1.5 rounded-md hover:bg-surface-subtle/75 transition-colors">
          <div className="flex items-center justify-between gap-2 min-w-0">
            {keyLabel}
            {removeButton}
          </div>
          <FieldValueControl field={field} callbacks={callbacks} />
        </div>
      );
    }

    return (
      <div className={UI_TOKENS.inspector.fieldRow}>
        {keyLabel}

        <div className="flex-1 min-w-0 flex items-center justify-end gap-1.5">
          <FieldValueControl field={field} callbacks={callbacks} />
          {removeButton}
        </div>
      </div>
    );
  }
);
