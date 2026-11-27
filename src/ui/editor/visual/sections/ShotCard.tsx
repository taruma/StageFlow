/**
 * Individual Shot Card inside `ShotsSection`, composing:
 * - Click-to-seek header, reorder actions & active-shot border
 * - Standalone `ShotTimingBar` (Free | Roll | Ripple + Start/End + Stamp t)
 * - Shot-level scalar/polymorphic fields, nested camera blocks & `EntityOverridesBlock`
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { VisualShotItem } from '../../../../core/scoreYamlProjectionHelpers';
import type {
  ShotTimingCallbacks,
  VisualEditorCallbacks,
} from '../visualEditorTypes';
import { SchemaFieldRow } from '../SchemaFieldRow';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { CardReorderActions } from '../CardReorderActions';
import { EntityOverridesBlock } from '../EntityOverridesBlock';
import { CameraBlockCard } from './CameraBlockCard';
import { ShotTimingBar } from './ShotTimingBar';

export interface ShotCardProps {
  shot: VisualShotItem;
  index: number;
  totalShots: number;
  bulkExpandSeq: number;
  bulkExpandMode: 'expand' | 'collapse';
  focusExpandSeq: number;
  isActiveShot: boolean;
  timingCallbacks: ShotTimingCallbacks;
  callbacks: VisualEditorCallbacks;
}

export const ShotCard: React.FC<ShotCardProps> = React.memo(
  ({
    shot,
    index,
    totalShots,
    bulkExpandSeq,
    bulkExpandMode,
    focusExpandSeq,
    isActiveShot,
    timingCallbacks,
    callbacks,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
      if (bulkExpandSeq > 0) {
        setIsExpanded(bulkExpandMode === 'expand');
      }
    }, [bulkExpandSeq, bulkExpandMode]);

    useEffect(() => {
      if (focusExpandSeq > 0) {
        setIsExpanded(true);
      }
    }, [focusExpandSeq]);

    const { disabled, onCommand, onCancelScrub, onSeekToTime } = callbacks;

    const scalarFields = useMemo(
      () =>
        shot.fields.filter(
          (f) => f.canonicalKey !== 'start' && f.canonicalKey !== 'end'
        ),
      [shot.fields]
    );

    const handleToggleHeader = useCallback(() => {
      onSeekToTime(shot.startSec);
      setIsExpanded((prev) => !prev);
    }, [onSeekToTime, shot.startSec]);

    const handleMoveUp = useCallback(() => {
      onCommand({ type: 'reorder-shot', fromIndex: index, toIndex: index - 1 });
    }, [index, onCommand]);

    const handleMoveDown = useCallback(() => {
      onCommand({ type: 'reorder-shot', fromIndex: index, toIndex: index + 1 });
    }, [index, onCommand]);

    const handleDelete = useCallback(() => {
      onCommand({ type: 'delete-shot', index });
    }, [index, onCommand]);

    return (
      <div
        data-shot-id={shot.id}
        className={`rounded-lg border transition-colors bg-app/50 overflow-visible ${
          isActiveShot
            ? 'border-amber-500/60 ring-1 ring-amber-500/20'
            : 'border-border-main'
        }`}
      >
        {/* Shot Header Row */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <button
            type="button"
            onClick={handleToggleHeader}
            className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
            title="Click to jump playhead to shot & toggle details"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-text-muted shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-text-muted shrink-0" />
            )}
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold shrink-0 tabular-nums ${
                isActiveShot
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                  : 'bg-surface-subtle text-text-muted'
              }`}
            >
              #{String(shot.shotNumber).padStart(2, '0')}
            </span>
            <span className="text-[11px] font-mono font-semibold text-text-main truncate">
              {shot.label}
            </span>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] font-mono text-text-muted tabular-nums">
              {shot.startSec.toFixed(2)}–{shot.endSec.toFixed(2)}s
            </span>
            <CardReorderActions
              disabled={disabled}
              canMoveUp={index > 0}
              canMoveDown={index < totalShots - 1}
              canDelete={totalShots > 1}
              moveUpTitle="Move shot up"
              moveDownTitle="Move shot down"
              deleteTitle={`Delete ${shot.id}`}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDelete={handleDelete}
            />
          </div>
        </div>

        {/* Compact Summary Telemetry Strip */}
        <div className="px-2.5 pb-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-text-faint">
          <span className="text-sky-600 dark:text-sky-400 font-semibold">
            {shot.summary.lensMm}mm
          </span>
          <span>·</span>
          <span className="uppercase">{shot.summary.maneuver}</span>
          <span>→</span>
          <span className="text-text-muted truncate max-w-[140px]">
            {shot.summary.targetLabel}
          </span>
          {shot.summary.hasRig && (
            <span className="px-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[9px]">
              RIG
            </span>
          )}
          {shot.summary.hasObserver && (
            <span className="px-1 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300 text-[9px]">
              OBS
            </span>
          )}
        </div>

        {/* Expanded Body */}
        {isExpanded && (
          <div className="px-2.5 pb-2.5 pt-2 border-t border-border-subtle space-y-2">
            <ShotTimingBar
              shotIndex={index}
              startSec={shot.startSec}
              endSec={shot.endSec}
              disabled={disabled}
              timingCallbacks={timingCallbacks}
              onCommand={onCommand}
              onCancelScrub={onCancelScrub}
            />

            <div className="space-y-0.5">
              {scalarFields.map((f) => (
                <SchemaFieldRow key={f.key} field={f} callbacks={callbacks} />
              ))}
            </div>

            {shot.stageCamera && (
              <CameraBlockCard
                block={shot.stageCamera}
                accentClass="text-amber-600 dark:text-amber-400"
                callbacks={callbacks}
              />
            )}

            {shot.observerCamera && (
              <CameraBlockCard
                block={shot.observerCamera}
                accentClass="text-sky-600 dark:text-sky-400"
                callbacks={callbacks}
                removable
                defaultExpanded={false}
              />
            )}

            <EntityOverridesBlock
              overrides={shot.entityOverrides}
              keyPrefix="entities."
              callbacks={callbacks}
            />

            <div className="pt-1 flex justify-end">
              <AddPropertyPopover
                section="shot"
                parentPath={shot.yamlPath}
                authoredRawKeys={shot.fields.map((f) => f.key)}
                label="+ Property"
                disabled={disabled}
                onCommand={onCommand}
              />
            </div>
          </div>
        )}
      </div>
    );
  }
);
