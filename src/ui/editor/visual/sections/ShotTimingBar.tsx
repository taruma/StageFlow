/**
 * Standalone Shot Timing Bar (`Free | Roll | Ripple` + `Start`/`End` FigmaNumberPills + Stamp Playhead `t`).
 * Owned exclusively inside ShotsSection / ShotCard so changing timing mode never re-renders sibling sections.
 */

import React, { useCallback } from 'react';
import { Clock } from 'lucide-react';
import type { ShotTimingEditMode } from '../../../../core/types';
import type { ScoreYamlCommand } from '../../../../core/scoreYamlMutator';
import type { ShotTimingCallbacks } from '../visualEditorTypes';
import { FigmaNumberPill } from '../FigmaNumberPill';

export interface ShotTimingBarProps {
  shotIndex: number;
  startSec: number;
  endSec: number;
  disabled: boolean;
  timingCallbacks: ShotTimingCallbacks;
  onCommand: (command: ScoreYamlCommand) => void;
  onCancelScrub: () => void;
}

const TIMING_MODES: readonly {
  id: ShotTimingEditMode;
  label: string;
  tip: string;
}[] = [
  { id: 'free', label: 'Free', tip: 'Edit this shot timestamp independently' },
  { id: 'roll', label: 'Roll', tip: 'Move cut boundary together with adjacent shot' },
  {
    id: 'ripple',
    label: 'Ripple',
    tip: 'Shift all downstream shots & scene duration',
  },
];

export const ShotTimingBar: React.FC<ShotTimingBarProps> = React.memo(
  ({
    shotIndex,
    startSec,
    endSec,
    disabled,
    timingCallbacks,
    onCommand,
    onCancelScrub,
  }) => {
    const {
      timingMode,
      onChangeTimingMode,
      onTimingScrubPreview,
      getCurrentTimeSec,
    } = timingCallbacks;

    const handleScrubStart = useCallback(
      (nextVal: number) => {
        onTimingScrubPreview(shotIndex, 'start', nextVal, timingMode);
      },
      [onTimingScrubPreview, shotIndex, timingMode]
    );

    const handleScrubEnd = useCallback(
      (nextVal: number) => {
        onTimingScrubPreview(shotIndex, 'end', nextVal, timingMode);
      },
      [onTimingScrubPreview, shotIndex, timingMode]
    );

    const handleTimingCommit = useCallback(
      (edge: 'start' | 'end', nextVal: number) => {
        onCommand({
          type: 'adjust-shot-timing',
          shotIndex,
          edge,
          nextValueSec: nextVal,
          mode: timingMode,
        });
      },
      [onCommand, shotIndex, timingMode]
    );

    const handleCommitStart = useCallback(
      (nextVal: number) => handleTimingCommit('start', nextVal),
      [handleTimingCommit]
    );

    const handleCommitEnd = useCallback(
      (nextVal: number) => handleTimingCommit('end', nextVal),
      [handleTimingCommit]
    );

    const handleStampStart = useCallback(() => {
      const t = Math.round(getCurrentTimeSec() * 1000) / 1000;
      handleTimingCommit('start', t);
    }, [getCurrentTimeSec, handleTimingCommit]);

    const handleStampEnd = useCallback(() => {
      const t = Math.round(getCurrentTimeSec() * 1000) / 1000;
      handleTimingCommit('end', t);
    }, [getCurrentTimeSec, handleTimingCommit]);

    return (
      <div className="rounded-lg bg-surface-subtle/70 border border-border-subtle p-1.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-text-muted">
            Timing ({(endSec - startSec).toFixed(2)}s)
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
              value={startSec}
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
              value={endSec}
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
    );
  }
);
