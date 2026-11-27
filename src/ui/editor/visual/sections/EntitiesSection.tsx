/**
 * Collapsible `entities:` section with drag-sortable entity cards (`@dnd-kit`),
 * sortable entity property keys, color dots, reorder/delete actions, and "+" insert-between seams.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { VisualEntityItem } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { UI_TOKENS } from '../../../tokens/ui';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { SortableList } from '../dnd/SortableList';
import { SortableItem } from '../dnd/SortableItem';
import { SortableFieldList } from '../SortableFieldList';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { InsertBetweenSeam } from '../InsertBetweenSeam';
import { CardReorderActions } from '../CardReorderActions';

export interface EntitiesSectionProps {
  entities: VisualEntityItem[];
  isSectionExpanded: boolean;
  onToggleSection: () => void;
  callbacks: VisualEditorCallbacks;
}

const EntityCard: React.FC<{
  ent: VisualEntityItem;
  idx: number;
  total: number;
  dragHandle?: React.ReactNode;
  callbacks: VisualEditorCallbacks;
}> = React.memo(({ ent, idx, total, dragHandle, callbacks }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = useCallback(() => setIsOpen((v) => !v), []);
  const { disabled, onCommand } = callbacks;

  return (
    <div className={UI_TOKENS.inspector.itemCard}>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {dragHandle}
          <button
            type="button"
            onClick={toggleOpen}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
          >
            {isOpen ? (
              <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
            )}
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
              style={{ backgroundColor: ent.color }}
            />
            <span className="text-[11px] font-mono font-semibold text-text-main truncate">
              {ent.label}
            </span>
            <span className="text-[10px] font-mono text-text-faint truncate">
              {ent.id}
            </span>
            <span className="px-1.5 py-0 rounded text-[9px] font-mono bg-surface-subtle border border-border-subtle text-text-muted shrink-0">
              {ent.kind}
            </span>
          </button>
        </div>

        <CardReorderActions
          disabled={disabled}
          canMoveUp={idx > 0}
          canMoveDown={idx < total - 1}
          deleteTitle={`Delete ${ent.id}`}
          onMoveUp={() =>
            onCommand({
              type: 'reorder-entity',
              fromIndex: idx,
              toIndex: idx - 1,
            })
          }
          onMoveDown={() =>
            onCommand({
              type: 'reorder-entity',
              fromIndex: idx,
              toIndex: idx + 1,
            })
          }
          onDelete={() => onCommand({ type: 'delete-entity', index: idx })}
        />
      </div>

      {isOpen && (
        <div className="px-2.5 pb-2 pt-1 border-t border-border-subtle space-y-0.5">
          <SortableFieldList
            parentPath={ent.yamlPath}
            fields={ent.fields}
            callbacks={callbacks}
          />
          <div className="pt-1 flex justify-end">
            <AddPropertyPopover
              section="entity"
              parentPath={ent.yamlPath}
              authoredRawKeys={ent.fields.map((f) => f.key)}
              label="+ Property"
              disabled={disabled}
              onCommand={onCommand}
            />
          </div>
        </div>
      )}
    </div>
  );
});

export const EntitiesSection: React.FC<EntitiesSectionProps> = React.memo(
  ({ entities, isSectionExpanded, onToggleSection, callbacks }) => {
    const { disabled, onCommand } = callbacks;

    const sortableIds = useMemo(() => {
      const counts = new Map<string, number>();
      return entities.map((e) => {
        const base = e.id || 'entity';
        const c = (counts.get(base) ?? 0) + 1;
        counts.set(base, c);
        return c === 1 ? base : `${base}#${c}`;
      });
    }, [entities]);

    const handleReorderEntities = useCallback(
      (fromIndex: number, toIndex: number) => {
        onCommand({ type: 'reorder-entity', fromIndex, toIndex });
      },
      [onCommand]
    );

    return (
      <CollapsibleYamlSection
        yamlKey="entities:"
        title="Cast, Props & Markers"
        count={entities.length}
        accentClass="text-emerald-600 dark:text-emerald-400"
        isExpanded={isSectionExpanded}
        onToggle={onToggleSection}
        actionSlot={
          !disabled && (
            <button
              type="button"
              onClick={() =>
                onCommand({
                  type: 'insert-entity',
                  afterIndex: entities.length - 1,
                })
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Entity</span>
            </button>
          )
        }
      >
        {entities.length === 0 ? (
          <p className="text-[11px] font-mono text-text-faint px-1.5 py-1">
            No entities defined.
          </p>
        ) : (
          <SortableList
            items={sortableIds}
            disabled={disabled || entities.length < 2}
            onReorder={handleReorderEntities}
          >
            <div>
              {entities.map((ent, idx) => {
                const sortId = sortableIds[idx];
                return (
                  <React.Fragment key={sortId}>
                    <SortableItem
                      id={sortId}
                      disabled={disabled || entities.length < 2}
                      handleTitle={`Drag to reorder ${ent.label}`}
                    >
                      {({ dragHandle }) => (
                        <EntityCard
                          ent={ent}
                          idx={idx}
                          total={entities.length}
                          dragHandle={dragHandle}
                          callbacks={callbacks}
                        />
                      )}
                    </SortableItem>
                    <InsertBetweenSeam
                      label="Insert entity"
                      disabled={disabled}
                      onInsert={() =>
                        onCommand({ type: 'insert-entity', afterIndex: idx })
                      }
                    />
                  </React.Fragment>
                );
              })}
            </div>
          </SortableList>
        )}
      </CollapsibleYamlSection>
    );
  }
);
