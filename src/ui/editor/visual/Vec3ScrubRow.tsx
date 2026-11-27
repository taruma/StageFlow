/**
 * Single-row X / Y / Z FigmaNumberPill triplet for 3D Vec3 fields
 * (position, size, target_offset, rig endpoints).
 */

import React, { useCallback } from 'react';
import { FigmaNumberPill } from './FigmaNumberPill';

export interface Vec3ScrubRowProps {
  value: [number, number, number];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onScrubPreview: (nextVec: [number, number, number]) => void;
  onCommit: (finalVec: [number, number, number]) => void;
  onCancelScrub?: () => void;
}

export function normalizeVec3Tuple(raw: unknown): [number, number, number] {
  if (Array.isArray(raw) && raw.length >= 3) {
    return [
      Number.isFinite(Number(raw[0])) ? Number(raw[0]) : 0,
      Number.isFinite(Number(raw[1])) ? Number(raw[1]) : 0,
      Number.isFinite(Number(raw[2])) ? Number(raw[2]) : 0,
    ];
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return [
      Number.isFinite(Number(o.x)) ? Number(o.x) : 0,
      Number.isFinite(Number(o.y)) ? Number(o.y) : 0,
      Number.isFinite(Number(o.z)) ? Number(o.z) : 0,
    ];
  }
  return [0, 0, 0];
}

export const Vec3ScrubRow: React.FC<Vec3ScrubRowProps> = React.memo(
  ({
    value,
    unit = 'm',
    min,
    max,
    step = 0.05,
    disabled = false,
    onScrubPreview,
    onCommit,
    onCancelScrub,
  }) => {
    const handleAxisScrub = useCallback(
      (axis: 0 | 1 | 2, nextAxisVal: number) => {
        const next: [number, number, number] = [...value];
        next[axis] = nextAxisVal;
        onScrubPreview(next);
      },
      [onScrubPreview, value]
    );

    const handleAxisCommit = useCallback(
      (axis: 0 | 1 | 2, nextAxisVal: number) => {
        const next: [number, number, number] = [...value];
        next[axis] = nextAxisVal;
        onCommit(next);
      },
      [onCommit, value]
    );

    return (
      <div className="flex flex-wrap items-center gap-1">
        <FigmaNumberPill
          label="X"
          labelClassName="text-rose-500 dark:text-rose-400"
          value={value[0]}
          unit={unit}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onScrubPreview={(v) => handleAxisScrub(0, v)}
          onCommit={(v) => handleAxisCommit(0, v)}
          onCancelScrub={onCancelScrub}
        />
        <FigmaNumberPill
          label="Y"
          labelClassName="text-emerald-600 dark:text-emerald-400"
          value={value[1]}
          unit={unit}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onScrubPreview={(v) => handleAxisScrub(1, v)}
          onCommit={(v) => handleAxisCommit(1, v)}
          onCancelScrub={onCancelScrub}
        />
        <FigmaNumberPill
          label="Z"
          labelClassName="text-sky-600 dark:text-sky-400"
          value={value[2]}
          unit={unit}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onScrubPreview={(v) => handleAxisScrub(2, v)}
          onCommit={(v) => handleAxisCommit(2, v)}
          onCancelScrub={onCancelScrub}
        />
      </div>
    );
  }
);
