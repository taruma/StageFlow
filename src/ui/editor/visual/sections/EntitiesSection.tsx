/**
 * Collapsible `entities:` section with per-entity cards, color dots,
 * reorder/delete actions, and "+" insert-between seams.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import type { VisualEntityItem } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { SchemaFieldRow } from '../SchemaFieldRow';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { InsertBetweenSeam } from '../InsertBetweenSeam';

export interface EntitiesSectionProps {
  entities: VisualEntityItem[];
  isSectionExpanded: boolean;
  bulkExpandSeq: number;
  bulkExpandMode: 'expand' | 'collapse';
  onToggleSection: () => void;
  callbacks: VisualEditorCallbacks;
}

const EntityCard: React.FC<{
  ent: VisualEntityItem;
  idx: number;
  total: number;
  bulkExpandSeq: number;
  bulkExpandMode: 'expand' | 'collapse';
  callbacks: VisualEditorCallbacks;
}> = React.memo(({ ent, idx, total, bulkExpandSeq, bulkExpandMode, callbacks }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (bulkExpandSeq > 0) {
      setIsOpen(bulkExpandMode === 'expand');
    }
  }, [bulkExpandSeq, bulkExpandMode]);

  const toggleOpen = useCallback(() => setIsOpen((v) => !v), []);
  const { disabled, onCommand } = callbacks;

  return (
    <div className="rounded-lg border border-border-main bg-app/50 overflow-visible">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
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

        {!disabled && (
          <div className="flex items-center gap-0.5 shrink-0">
            {idx > 0 && (
              <button
                type="button"
                onClick={() =>
                  onCommand({
                    type: 'reorder-entity',
                    fromIndex: idx,
                    toIndex: idx - 1,
                  })
                }
                className="p-0.5 rounded text-text-faint hover:text-text-main cursor-pointer"
                title="Move up"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
            )}
            {idx < total - 1 && (
              <button
                type="button"
                onClick={() =>
                  onCommand({
                    type: 'reorder-entity',
                    fromIndex: idx,
                    toIndex: idx + 1,
                  })
                }
                className="p-0.5 rounded text-text-faint hover:text-text-main cursor-pointer"
                title="Move down"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onCommand({ type: 'delete-entity', index: idx })}
              className="p-0.5 rounded text-text-faint hover:text-rose-500 cursor-pointer"
              title={`Delete ${ent.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="px-2.5 pb-2 pt-1 border-t border-border-subtle space-y-0.5">
          {ent.fields.map((f) => (
            <SchemaFieldRow key={f.key} field={f} callbacks={callbacks} />
          ))}
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
  ({
    entities,
    isSectionExpanded,
    bulkExpandSeq,
    bulkExpandMode,
    onToggleSection,
    callbacks,
  }) => {
    const { disabled, onCommand } = callbacks;

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
          <div>
            {entities.map((ent, idx) => (
              <React.Fragment key={`entity:${idx}:${ent.id}`}>
                <EntityCard
                  ent={ent}
                  idx={idx}
                  total={entities.length}
                  bulkExpandSeq={bulkExpandSeq}
                  bulkExpandMode={bulkExpandMode}
                  callbacks={callbacks}
                />
                <InsertBetweenSeam
                  label="Insert entity"
                  disabled={disabled}
                  onInsert={() =>
                    onCommand({ type: 'insert-entity', afterIndex: idx })
                  }
                />
              </React.Fragment>
            ))}
          </div>
        )}
      </CollapsibleYamlSection>
    );
  }
);
