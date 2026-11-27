/**
 * Reusable drag-sortable YAML key list wrapper for `VisualFieldNode[]` maps.
 * Dispatches `reorder-map-key` commands via `@dnd-kit` while preserving comments and formatting.
 */

import React, { useMemo, useCallback } from 'react';
import type { VisualFieldNode } from '../../../core/scoreYamlProjectionHelpers';
import type { YamlPath } from '../../../core/schema/scoreSchemaTypes';
import type { VisualEditorCallbacks } from './visualEditorTypes';
import { SortableList } from './dnd/SortableList';
import { SortableItem } from './dnd/SortableItem';
import { SchemaFieldRow } from './SchemaFieldRow';

export interface SortableFieldListProps {
  parentPath: YamlPath;
  fields: VisualFieldNode[];
  callbacks: VisualEditorCallbacks;
}

export const SortableFieldList: React.FC<SortableFieldListProps> = React.memo(
  ({ parentPath, fields, callbacks }) => {
    const { disabled, onCommand } = callbacks;
    const keys = useMemo(() => fields.map((f) => f.key), [fields]);

    const handleReorder = useCallback(
      (fromIndex: number, toIndex: number) => {
        const fromKey = fields[fromIndex]?.key;
        const toKey = fields[toIndex]?.key;
        if (!fromKey || !toKey || fromKey === toKey) return;
        onCommand({
          type: 'reorder-map-key',
          parentPath,
          fromKey,
          toKey,
        });
      },
      [fields, onCommand, parentPath]
    );

    return (
      <SortableList
        items={keys}
        disabled={disabled || fields.length < 2}
        onReorder={handleReorder}
      >
        <div className="space-y-0.5">
          {fields.map((f) => (
            <SortableItem
              key={f.key}
              id={f.key}
              disabled={disabled || fields.length < 2}
              handleTitle={`Drag to reorder "${f.key}"`}
              handleClassName="opacity-0 group-hover:opacity-75 focus:opacity-100 hover:!opacity-100"
            >
              {({ dragHandle }) => (
                <SchemaFieldRow
                  field={f}
                  callbacks={callbacks}
                  dragHandle={dragHandle}
                />
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>
    );
  }
);
