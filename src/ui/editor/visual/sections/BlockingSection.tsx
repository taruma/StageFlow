/**
 * Collapsible `blocking:` section supporting both single-entity and multi-entity
 * (`entities: { ... }`) blocking cues, with click-to-seek playhead sync.
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { VisualBlockingItem } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { UI_TOKENS } from '../../../tokens/ui';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { SortableFieldList } from '../SortableFieldList';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { InsertBetweenSeam } from '../InsertBetweenSeam';
import { CardReorderActions } from '../CardReorderActions';
import { EntityOverridesBlock } from '../EntityOverridesBlock';

export interface BlockingSectionProps {
  blocking: VisualBlockingItem[];
  isSectionExpanded: boolean;
  onToggleSection: () => void;
  callbacks: VisualEditorCallbacks;
}

const BlockingCard: React.FC<{
  cue: VisualBlockingItem;
  idx: number;
  total: number;
  callbacks: VisualEditorCallbacks;
}> = React.memo(({ cue, idx, total, callbacks }) => {
  const [isOpen, setIsOpen] = useState(false);

  const { disabled, onCommand, onSeekToTime } = callbacks;
  const handleFocusCue = useCallback(() => {
    onSeekToTime(cue.startSec);
  }, [onSeekToTime, cue.startSec]);
  const handleToggleExpand = useCallback(() => {
    setIsOpen((v) => !v);
  }, []);

  return (
    <div className={UI_TOKENS.inspector.itemCard}>
      <div
        onClick={handleFocusCue}
        onDoubleClick={handleToggleExpand}
        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-surface-subtle/50 transition-colors cursor-pointer ${
          isOpen ? 'rounded-t-lg' : 'rounded-lg'
        }`}
        title="Click to jump playhead to cue · Click chevron or double-click to expand"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Collapse cue details' : 'Expand cue details'}
            title={isOpen ? 'Collapse cue details' : 'Expand cue details'}
            className="p-0.5 -ml-0.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-main cursor-pointer shrink-0 transition-colors"
          >
            {isOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
          <span className="px-1.5 py-0.2 rounded bg-surface-subtle border border-border-subtle text-[10px] font-mono text-violet-600 dark:text-violet-300 shrink-0 tabular-nums">
            {cue.startSec.toFixed(2)}–{cue.endSec.toFixed(2)}s
          </span>
          <span className="text-[11px] font-mono font-semibold text-text-main truncate">
            {cue.label}
          </span>
          {cue.entityId ? (
            <span className="text-[10px] font-mono text-text-faint shrink-0">
              → {cue.entityId}
            </span>
          ) : cue.entityOverrides.length > 0 ? (
            <span className="text-[10px] font-mono text-text-faint shrink-0">
              ({cue.entityOverrides.length} entities)
            </span>
          ) : null}
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <CardReorderActions
            disabled={disabled}
            canMoveUp={idx > 0}
            canMoveDown={idx < total - 1}
            deleteTitle={`Delete ${cue.id}`}
            onMoveUp={() =>
              onCommand({
                type: 'reorder-blocking',
                fromIndex: idx,
                toIndex: idx - 1,
              })
            }
            onMoveDown={() =>
              onCommand({
                type: 'reorder-blocking',
                fromIndex: idx,
                toIndex: idx + 1,
              })
            }
            onDelete={() => onCommand({ type: 'delete-blocking', index: idx })}
          />
        </div>
      </div>

      {isOpen && (
        <div className="px-2.5 pb-2 pt-1 border-t border-border-subtle space-y-1">
          <SortableFieldList
            parentPath={cue.yamlPath}
            fields={cue.fields}
            callbacks={callbacks}
          />

          <EntityOverridesBlock
            overrides={cue.entityOverrides}
            callbacks={callbacks}
          />

          <div className="pt-1 flex justify-end">
            <AddPropertyPopover
              section="blockingCue"
              parentPath={cue.yamlPath}
              authoredRawKeys={cue.fields.map((f) => f.key)}
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

export const BlockingSection: React.FC<BlockingSectionProps> = React.memo(
  ({ blocking, isSectionExpanded, onToggleSection, callbacks }) => {
    const { disabled, onCommand } = callbacks;

    return (
      <CollapsibleYamlSection
        yamlKey="blocking:"
        title="Entity Choreography"
        count={blocking.length}
        accentClass="text-violet-600 dark:text-violet-400"
        isExpanded={isSectionExpanded}
        onToggle={onToggleSection}
        actionSlot={
          !disabled && (
            <button
              type="button"
              onClick={() =>
                onCommand({
                  type: 'insert-blocking',
                  afterIndex: blocking.length - 1,
                })
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-[10px] font-mono font-semibold text-violet-700 dark:text-violet-300 cursor-pointer transition-colors"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>Cue</span>
            </button>
          )
        }
      >
        {blocking.length === 0 ? (
          <p className="text-[11px] font-mono text-text-faint px-1.5 py-1">
            No decoupled blocking cues. Click + Cue to stage movement across cuts.
          </p>
        ) : (
          <div>
            {blocking.map((cue, idx) => (
              <React.Fragment key={`blocking:${idx}:${cue.id}`}>
                <BlockingCard
                  cue={cue}
                  idx={idx}
                  total={blocking.length}
                  callbacks={callbacks}
                />
                <InsertBetweenSeam
                  label="Insert cue"
                  disabled={disabled}
                  onInsert={() =>
                    onCommand({ type: 'insert-blocking', afterIndex: idx })
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
