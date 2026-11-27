/**
 * Collapsible `observer_shots:` section for decoupled Observer Camera choreography.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { VisualObserverShotItem } from '../../../../core/scoreYamlProjectionHelpers';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { CollapsibleYamlSection } from '../CollapsibleYamlSection';
import { SchemaFieldRow } from '../SchemaFieldRow';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { InsertBetweenSeam } from '../InsertBetweenSeam';
import { CardReorderActions } from '../CardReorderActions';
import { WaypointsBlock } from '../WaypointsBlock';
import { CameraBlockCard } from './CameraBlockCard';

export interface ObserverShotsSectionProps {
  observerShots: VisualObserverShotItem[];
  isSectionExpanded: boolean;
  bulkExpandSeq: number;
  bulkExpandMode: 'expand' | 'collapse';
  onToggleSection: () => void;
  callbacks: VisualEditorCallbacks;
}

const ObserverShotCard: React.FC<{
  os: VisualObserverShotItem;
  idx: number;
  total: number;
  bulkExpandSeq: number;
  bulkExpandMode: 'expand' | 'collapse';
  callbacks: VisualEditorCallbacks;
}> = React.memo(({ os, idx, total, bulkExpandSeq, bulkExpandMode, callbacks }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (bulkExpandSeq > 0) {
      setIsOpen(bulkExpandMode === 'expand');
    }
  }, [bulkExpandSeq, bulkExpandMode]);

  const { disabled, onCommand, onSeekToTime } = callbacks;
  const handleHeaderClick = useCallback(() => {
    onSeekToTime(os.startSec);
    setIsOpen((v) => !v);
  }, [onSeekToTime, os.startSec]);

  return (
    <div className="rounded-lg border border-border-main bg-app/50 overflow-visible">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={handleHeaderClick}
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

        <CardReorderActions
          disabled={disabled}
          canMoveUp={idx > 0}
          canMoveDown={idx < total - 1}
          deleteTitle={`Delete ${os.id}`}
          onMoveUp={() =>
            onCommand({
              type: 'reorder-observer-shot',
              fromIndex: idx,
              toIndex: idx - 1,
            })
          }
          onMoveDown={() =>
            onCommand({
              type: 'reorder-observer-shot',
              fromIndex: idx,
              toIndex: idx + 1,
            })
          }
          onDelete={() =>
            onCommand({ type: 'delete-observer-shot', index: idx })
          }
        />
      </div>

      {isOpen && (
        <div className="px-2.5 pb-2 pt-1 border-t border-border-subtle space-y-1.5">
          <div className="space-y-0.5">
            {os.fields.map((f) => (
              <SchemaFieldRow key={f.key} field={f} callbacks={callbacks} />
            ))}
          </div>

          {os.camera && (
            <CameraBlockCard
              block={os.camera}
              accentClass="text-sky-600 dark:text-sky-400"
              callbacks={callbacks}
            />
          )}

          <WaypointsBlock
            waypoints={os.flatWaypoints}
            callbacks={callbacks}
          />

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
  );
});

export const ObserverShotsSection: React.FC<ObserverShotsSectionProps> =
  React.memo(
    ({
      observerShots,
      isSectionExpanded,
      bulkExpandSeq,
      bulkExpandMode,
      onToggleSection,
      callbacks,
    }) => {
      const { disabled, onCommand } = callbacks;

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
              {observerShots.map((os, idx) => (
                <React.Fragment key={`obs:${idx}:${os.id}`}>
                  <ObserverShotCard
                    os={os}
                    idx={idx}
                    total={observerShots.length}
                    bulkExpandSeq={bulkExpandSeq}
                    bulkExpandMode={bulkExpandMode}
                    callbacks={callbacks}
                  />
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
              ))}
            </div>
          )}
        </CollapsibleYamlSection>
      );
    }
  );
