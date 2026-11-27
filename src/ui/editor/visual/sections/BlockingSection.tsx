/**
 * Collapsible `blocking:` section supporting both single-entity and multi-entity
 * (`entities: { ... }`) blocking cues, with click-to-seek playhead sync.
 */

import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import type { VisualBlockingItem } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { SchemaFieldRow } from '../SchemaFieldRow';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { InsertBetweenSeam } from '../InsertBetweenSeam';

export interface BlockingSectionProps {
  blocking: VisualBlockingItem[];
  isSectionExpanded: boolean;
  expandedIds: ReadonlySet<string>;
  onToggleSection: () => void;
  onToggleItem: (key: string) => void;
  callbacks: VisualEditorCallbacks;
}

export const BlockingSection: React.FC<BlockingSectionProps> = React.memo(
  ({
    blocking,
    isSectionExpanded,
    expandedIds,
    onToggleSection,
    onToggleItem,
    callbacks,
  }) => {
    const { disabled, onCommand, onSeekToTime } = callbacks;

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
            {blocking.map((cue, idx) => {
              const itemKey = `blocking:${idx}:${cue.id}`;
              const isOpen = expandedIds.has(itemKey);

              return (
                <React.Fragment key={itemKey}>
                  <div className="rounded-lg border border-border-main bg-app/50 overflow-visible">
                    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSeekToTime(cue.startSec);
                          onToggleItem(itemKey);
                        }}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                        title="Click to jump playhead & expand cue"
                      >
                        {isOpen ? (
                          <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                        )}
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
                      </button>

                      {!disabled && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                onCommand({
                                  type: 'reorder-blocking',
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
                          {idx < blocking.length - 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                onCommand({
                                  type: 'reorder-blocking',
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
                            onClick={() =>
                              onCommand({ type: 'delete-blocking', index: idx })
                            }
                            className="p-0.5 rounded text-text-faint hover:text-rose-500 cursor-pointer"
                            title={`Delete ${cue.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isOpen && (
                      <div className="px-2.5 pb-2 pt-1 border-t border-border-subtle space-y-1">
                        {cue.fields.map((f) => (
                          <SchemaFieldRow
                            key={f.key}
                            field={f}
                            callbacks={callbacks}
                          />
                        ))}

                        {cue.entityOverrides.map((ov) => (
                          <div
                            key={ov.name}
                            className="mt-1 pl-2.5 border-l-2 border-emerald-500/40 space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2 py-0.5">
                              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {ov.name}:
                              </span>
                              <AddPropertyPopover
                                section="blockingEntity"
                                parentPath={ov.yamlPath}
                                authoredRawKeys={ov.fields.map((f) => f.key)}
                                label="+ Key"
                                disabled={disabled}
                                onCommand={onCommand}
                              />
                            </div>
                            {ov.fields.map((f) => (
                              <SchemaFieldRow
                                key={f.key}
                                field={f}
                                callbacks={callbacks}
                              />
                            ))}
                          </div>
                        ))}

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

                  <InsertBetweenSeam
                    label="Insert cue"
                    disabled={disabled}
                    onInsert={() =>
                      onCommand({ type: 'insert-blocking', afterIndex: idx })
                    }
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </CollapsibleYamlSection>
    );
  }
);
