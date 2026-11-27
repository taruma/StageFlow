/**
 * Individual Shot Card inside `ShotsSection`, featuring:
 * - Click-to-seek playhead & subtle active-shot border
 * - Free | Roll | Ripple timing bar with Figma scrubbers & 1-click Stamp Playhead `t`
 * - Indented child blocks (stage_camera, observer_camera, entities overrides)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Clock,
  Trash2,
} from 'lucide-react';
import type { VisualShotItem } from '../../../../core/scoreYamlProjectionHelpers';
import type { ShotTimingEditMode } from '../../../../core/types';
import type { VisualEditorCallbacks } from '../visualEditorTypes';
import { FigmaNumberPill } from '../FigmaNumberPill';
import { SchemaFieldRow } from '../SchemaFieldRow';
import { AddPropertyPopover } from '../AddPropertyPopover';
import { CameraBlockCard } from './CameraBlockCard';

export interface ShotCardProps {
  shot: VisualShotItem;
  index: number;
  totalShots: number;
  bulkExpandSeq: number;
  bulkExpandMode: 'expand' | 'collapse';
  focusExpandSeq: number;
  isActiveShot: boolean;
  callbacks: VisualEditorCallbacks;
}

const TIMING_MODES: readonly { id: ShotTimingEditMode; label: string; tip: string }[] = [
  { id: 'free', label: 'Free', tip: 'Edit this shot timestamp independently' },
  { id: 'roll', label: 'Roll', tip: 'Move cut boundary together with adjacent shot' },
  { id: 'ripple', label: 'Ripple', tip: 'Shift all downstream shots & scene duration' },
];

export const ShotCard: React.FC<ShotCardProps> = React.memo(
  ({
    shot,
    index,
    totalShots,
    bulkExpandSeq,
    bulkExpandMode,
    focusExpandSeq,
    isActiveShot,
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

    const {
      disabled,
      timingMode,
      onChangeTimingMode,
      onCommand,
      onTimingScrubPreview,
      onCancelScrub,
      onSeekToTime,
      getCurrentTimeSec,
    } = callbacks;

    const scalarFields = useMemo(
      () =>
        shot.fields.filter(
          (f) => f.canonicalKey !== 'start' && f.canonicalKey !== 'end'
        ),
      [shot.fields]
    );

    const handleScrubStart = useCallback(
      (nextVal: number) => {
        onTimingScrubPreview(index, 'start', nextVal, timingMode);
      },
      [index, onTimingScrubPreview, timingMode]
    );

    const handleScrubEnd = useCallback(
      (nextVal: number) => {
        onTimingScrubPreview(index, 'end', nextVal, timingMode);
      },
      [index, onTimingScrubPreview, timingMode]
    );

    const handleTimingCommit = useCallback(
      (edge: 'start' | 'end', nextVal: number) => {
        onCommand({
          type: 'adjust-shot-timing',
          shotIndex: index,
          edge,
          nextValueSec: nextVal,
          mode: timingMode,
        });
      },
      [index, onCommand, timingMode]
    );

    const handleCommitStart = useCallback(
      (nextVal: number) => handleTimingCommit('start', nextVal),
      [handleTimingCommit]
    );

    const handleCommitEnd = useCallback(
      (nextVal: number) => handleTimingCommit('end', nextVal),
      [handleTimingCommit]
    );

    const handleToggleHeader = useCallback(() => {
      onSeekToTime(shot.startSec);
      setIsExpanded((prev) => !prev);
    }, [onSeekToTime, shot.startSec]);

    const handleStampStart = useCallback(() => {
      const t = Math.round(getCurrentTimeSec() * 1000) / 1000;
      handleTimingCommit('start', t);
    }, [getCurrentTimeSec, handleTimingCommit]);

    const handleStampEnd = useCallback(() => {
      const t = Math.round(getCurrentTimeSec() * 1000) / 1000;
      handleTimingCommit('end', t);
    }, [getCurrentTimeSec, handleTimingCommit]);

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
            {!disabled && (
              <div className="flex items-center gap-0.5 ml-1">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onCommand({
                        type: 'reorder-shot',
                        fromIndex: index,
                        toIndex: index - 1,
                      })
                    }
                    className="p-0.5 rounded text-text-faint hover:text-text-main cursor-pointer"
                    title="Move shot up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                )}
                {index < totalShots - 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onCommand({
                        type: 'reorder-shot',
                        fromIndex: index,
                        toIndex: index + 1,
                      })
                    }
                    className="p-0.5 rounded text-text-faint hover:text-text-main cursor-pointer"
                    title="Move shot down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                )}
                {totalShots > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onCommand({ type: 'delete-shot', index })
                    }
                    className="p-0.5 rounded text-text-faint hover:text-rose-500 cursor-pointer"
                    title={`Delete ${shot.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
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
            {/* Shot Timing Bar: Free | Roll | Ripple + Start/End + Stamp t */}
            <div className="rounded-lg bg-surface-subtle/70 border border-border-subtle p-1.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-text-muted">
                  Timing ({(shot.endSec - shot.startSec).toFixed(2)}s)
                </span>
                <div className="inline-flex items-center rounded-md bg-surface border border-border-main p-0.5">
                  {TIMING_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChangeTimingMode(m.id)}
                      title={m.tip}
                      className={`px-1.5 py-0.2 rounded text-[9px] font-mono cursor-pointer transition-colors ${
                        timingMode === m.id
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  <FigmaNumberPill
                    label="Start"
                    value={shot.startSec}
                    unit="s"
                    min={0}
                    max={3600}
                    step={0.05}
                    precision={3}
                    disabled={disabled}
                    onScrubPreview={handleScrubStart}
                    onCommit={handleCommitStart}
                    onCancelScrub={onCancelScrub}
                  />
                  {!disabled && (
                    <button
                      type="button"
                      onClick={handleStampStart}
                      className="p-1 rounded bg-surface hover:bg-surface-hover border border-border-main text-text-muted hover:text-amber-500 cursor-pointer"
                      title="Set Start to current playhead time"
                    >
                      <Clock className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <FigmaNumberPill
                    label="End"
                    value={shot.endSec}
                    unit="s"
                    min={0.1}
                    max={3600}
                    step={0.05}
                    precision={3}
                    disabled={disabled}
                    onScrubPreview={handleScrubEnd}
                    onCommit={handleCommitEnd}
                    onCancelScrub={onCancelScrub}
                  />
                  {!disabled && (
                    <button
                      type="button"
                      onClick={handleStampEnd}
                      className="p-1 rounded bg-surface hover:bg-surface-hover border border-border-main text-text-muted hover:text-amber-500 cursor-pointer"
                      title="Set End to current playhead time"
                    >
                      <Clock className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Shot Scalar & Flat Polymorphic Fields */}
            <div className="space-y-0.5">
              {scalarFields.map((f) => (
                <SchemaFieldRow key={f.key} field={f} callbacks={callbacks} />
              ))}
            </div>

            {/* Nested Stage Camera Block */}
            {shot.stageCamera && (
              <CameraBlockCard
                block={shot.stageCamera}
                accentClass="text-amber-600 dark:text-amber-400"
                callbacks={callbacks}
              />
            )}

            {/* Nested Coupled Observer Camera Block */}
            {shot.observerCamera && (
              <CameraBlockCard
                block={shot.observerCamera}
                accentClass="text-sky-600 dark:text-sky-400"
                callbacks={callbacks}
                removable
                defaultExpanded={false}
              />
            )}

            {/* Nested Coupled Shot Entity Overrides */}
            {shot.entityOverrides.map((ov) => (
              <div
                key={ov.name}
                className="pl-2.5 border-l-2 border-emerald-500/40 space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    entities.{ov.name}:
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
