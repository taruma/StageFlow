/**
 * Collapsible `observer_shots:` section for decoupled Observer Camera choreography.
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
import type { VisualObserverShotItem } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { SchemaFieldRow } from '../SchemaFieldRow';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { InsertBetweenSeam } from '../InsertBetweenSeam';
import { CameraBlockCard } from './CameraBlockCard';

export interface ObserverShotsSectionProps {
  observerShots: VisualObserverShotItem[];
  isSectionExpanded: boolean;
  expandedIds: ReadonlySet<string>;
  onToggleSection: () => void;
  onToggleItem: (key: string) => void;
  callbacks: VisualEditorCallbacks;
}

export const ObserverShotsSection: React.FC<ObserverShotsSectionProps> =
  React.memo(
    ({
      observerShots,
      isSectionExpanded,
      expandedIds,
      onToggleSection,
      onToggleItem,
      callbacks,
    }) => {
      const { disabled, onCommand, onSeekToTime } = callbacks;

      return (
        <CollapsibleYamlSection
          yamlKey="observer_shots:"
          title="Observer Diorama Orbits"
          count={observerShots.length}
          accentClass="text-sky-600 dark:text-sky-400"
          isExpanded={isSectionExpanded}
          onToggle={onToggleSection}
          actionSlot={
            !disabled && (
              <button
                type="button"
                onClick={() =>
                  onCommand({
                    type: 'insert-observer-shot',
                    afterIndex: observerShots.length - 1,
                  })
                }
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-[10px] font-mono font-semibold text-sky-700 dark:text-sky-300 cursor-pointer transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Observer</span>
              </button>
            )
          }
        >
          {observerShots.length === 0 ? (
            <p className="text-[11px] font-mono text-text-faint px-1.5 py-1">
              No decoupled observer_shots authored.
            </p>
          ) : (
            <div>
              {observerShots.map((os, idx) => {
                const itemKey = `obs:${idx}:${os.id}`;
                const isOpen = expandedIds.has(itemKey);

                return (
                  <React.Fragment key={itemKey}>
                    <div className="rounded-lg border border-border-main bg-app/50 overflow-visible">
                      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSeekToTime(os.startSec);
                            onToggleItem(itemKey);
                          }}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                          title="Click to jump playhead & expand observer cue"
                        >
                          {isOpen ? (
                            <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
                          )}
                          <span className="px-1.5 py-0.2 rounded bg-surface-subtle border border-border-subtle text-[10px] font-mono text-sky-600 dark:text-sky-300 shrink-0 tabular-nums">
                            {os.startSec.toFixed(2)}–{os.endSec.toFixed(2)}s
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-text-main truncate">
                            {os.label}
                          </span>
                        </button>

                        {!disabled && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onCommand({
                                    type: 'reorder-observer-shot',
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
                            {idx < observerShots.length - 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  onCommand({
                                    type: 'reorder-observer-shot',
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
                                onCommand({
                                  type: 'delete-observer-shot',
                                  index: idx,
                                })
                              }
                              className="p-0.5 rounded text-text-faint hover:text-rose-500 cursor-pointer"
                              title={`Delete ${os.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isOpen && (
                        <div className="px-2.5 pb-2 pt-1 border-t border-border-subtle space-y-1.5">
                          <div className="space-y-0.5">
                            {os.fields.map((f) => (
                              <SchemaFieldRow
                                key={f.key}
                                field={f}
                                callbacks={callbacks}
                              />
                            ))}
                          </div>

                          {os.camera && (
                            <CameraBlockCard
                              block={os.camera}
                              accentClass="text-sky-600 dark:text-sky-400"
                              callbacks={callbacks}
                            />
                          )}

                          {os.flatWaypoints && os.flatWaypoints.length > 0 && (
                            <div className="pl-2.5 border-l-2 border-violet-500/40 space-y-1">
                              <div className="text-[10px] font-mono font-bold text-violet-600 dark:text-violet-400">
                                waypoints: ({os.flatWaypoints.length})
                              </div>
                              {os.flatWaypoints.map((wp) => (
                                <div
                                  key={wp.index}
                                  className="rounded-lg bg-surface-subtle/60 border border-border-subtle p-1.5 space-y-0.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[9px] font-mono font-semibold text-text-muted">
                                      #{wp.index + 1}
                                    </span>
                                    <AddPropertyPopover
                                      section="waypoint"
                                      parentPath={wp.yamlPath}
                                      authoredRawKeys={wp.fields.map(
                                        (f) => f.key
                                      )}
                                      label="+ Key"
                                      disabled={disabled}
                                      onCommand={onCommand}
                                    />
                                  </div>
                                  {wp.fields.map((wf) => (
                                    <SchemaFieldRow
                                      key={wf.key}
                                      field={wf}
                                      callbacks={callbacks}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="pt-1 flex justify-end">
                            <AddPropertyPopover
                              section="observerShot"
                              parentPath={os.yamlPath}
                              authoredRawKeys={os.fields.map((f) => f.key)}
                              label="+ Property"
                              disabled={disabled}
                              onCommand={onCommand}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <InsertBetweenSeam
                      label="Insert observer cue"
                      disabled={disabled}
                      onInsert={() =>
                        onCommand({
                          type: 'insert-observer-shot',
                          afterIndex: idx,
                        })
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
