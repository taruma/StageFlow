/**
 * Figma-style inline scrubbable number pill.
 * - Drag horizontally on the label/pill (`ew-resize`) for live 60fps 3D scrubbing
 *   (`Shift` = 10x coarse, `Alt` = 0.1x fine, `Esc` = cancel back to baseline).
 * - Click the numeric readout to enter exact inline text editing (`data-native-undo`).
 * - Supports ArrowUp / ArrowDown step nudging while editing.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UI_TOKENS } from '../../tokens/ui';

export interface FigmaNumberPillProps {
  label?: string;
  labelClassName?: string;
  value: number;
  unit?: string;
  prefix?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  title?: string;
  onScrubPreview: (nextValue: number) => void;
  onCommit: (finalValue: number) => void;
  onCancelScrub?: () => void;
}

function clampAndRound(
  val: number,
  min: number | undefined,
  max: number | undefined,
  precision: number
): number {
  let next = val;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  const factor = Math.pow(10, precision);
  return Math.round(next * factor) / factor;
}

export const FigmaNumberPill: React.FC<FigmaNumberPillProps> = React.memo(
  ({
    label,
    labelClassName = 'text-text-muted',
    value,
    unit,
    prefix,
    min,
    max,
    step = 0.1,
    precision = 2,
    disabled = false,
    title,
    onScrubPreview,
    onCommit,
    onCancelScrub,
  }) => {
    const [isEditingText, setIsEditingText] = useState(false);
    const [draftText, setDraftText] = useState('');
    const [dragPreviewVal, setDragPreviewVal] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const dragStateRef = useRef<{
      active: boolean;
      moved: boolean;
      startX: number;
      startVal: number;
      latestVal: number;
    }>({
      active: false,
      moved: false,
      startX: 0,
      startVal: value,
      latestVal: value,
    });
    const pendingRafRef = useRef<number | null>(null);
    const pendingScrubValRef = useRef<number | null>(null);

    const cancelPendingRaf = useCallback(() => {
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      pendingScrubValRef.current = null;
    }, []);

    useEffect(() => {
      return () => {
        if (pendingRafRef.current !== null) {
          cancelAnimationFrame(pendingRafRef.current);
          pendingRafRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (isEditingText) {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }, [isEditingText]);

    const commitTextDraft = useCallback(() => {
      setIsEditingText(false);
      const cleaned = draftText.trim().replace(/^(f\/|t\/)/i, '').replace(/(mm|deg|°|m|s)$/i, '');
      const parsed = Number(cleaned);
      if (!Number.isFinite(parsed)) return;
      const clamped = clampAndRound(parsed, min, max, precision);
      if (clamped !== value) {
        onCommit(clamped);
      }
    }, [draftText, max, min, onCommit, precision, value]);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || isEditingText || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        cancelPendingRaf();
        dragStateRef.current = {
          active: true,
          moved: false,
          startX: e.clientX,
          startVal: value,
          latestVal: value,
        };
      },
      [cancelPendingRaf, disabled, isEditingText, value]
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const st = dragStateRef.current;
        if (!st.active) return;

        const dx = e.clientX - st.startX;
        if (!st.moved && Math.abs(dx) < 3) return;
        st.moved = true;

        const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const deltaUnits = (dx / 6) * step * mult;
        const next = clampAndRound(
          st.startVal + deltaUnits,
          min,
          max,
          precision
        );
        if (next !== st.latestVal) {
          st.latestVal = next;
          setDragPreviewVal(next);
          pendingScrubValRef.current = next;
          if (pendingRafRef.current === null) {
            pendingRafRef.current = requestAnimationFrame(() => {
              pendingRafRef.current = null;
              if (!dragStateRef.current.active) return;
              const valToScrub = pendingScrubValRef.current;
              pendingScrubValRef.current = null;
              if (valToScrub !== null) {
                onScrubPreview(valToScrub);
              }
            });
          }
        }
      },
      [max, min, onScrubPreview, precision, step]
    );

    const finishDrag = useCallback(
      (cancelled: boolean) => {
        const st = dragStateRef.current;
        if (!st.active) return;
        st.active = false;
        cancelPendingRaf();
        setDragPreviewVal(null);

        if (cancelled) {
          onCancelScrub?.();
          return;
        }
        if (!st.moved) {
          // Plain click -> enter inline exact text editing
          setDraftText(String(Number(value.toFixed(precision))));
          setIsEditingText(true);
          return;
        }
        if (st.latestVal !== st.startVal) {
          onCommit(st.latestVal);
        } else {
          onCancelScrub?.();
        }
      },
      [cancelPendingRaf, onCancelScrub, onCommit, precision, value]
    );

    useEffect(() => {
      if (dragPreviewVal === null) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          finishDrag(true);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [dragPreviewVal, finishDrag]);

    const shownVal = dragPreviewVal ?? value;
    const formatted = Number.isInteger(shownVal)
      ? String(shownVal)
      : Number(shownVal.toFixed(precision)).toString();

    if (isEditingText) {
      return (
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface border border-amber-500/60 ring-1 ring-amber-500/20">
          {label && (
            <span className={`text-[10px] font-mono font-bold ${labelClassName}`}>
              {label}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            data-native-undo="true"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onBlur={commitTextDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitTextDraft();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsEditingText(false);
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const curr = Number(draftText);
                if (!Number.isFinite(curr)) return;
                const dir = e.key === 'ArrowUp' ? 1 : -1;
                const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
                const next = clampAndRound(
                  curr + dir * step * mult,
                  min,
                  max,
                  precision
                );
                setDraftText(String(next));
                onScrubPreview(next);
              }
            }}
            className="w-14 bg-transparent text-[11px] font-mono text-text-main outline-none tabular-nums"
          />
        </div>
      );
    }

    return (
      <div
        role="spinbutton"
        aria-valuenow={shownVal}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label ?? title ?? 'Numeric scrubber'}
        title={
          disabled
            ? `${formatted}${unit ?? ''} (Fork to edit)`
            : title ?? 'Drag horizontally to scrub (Shift = fast, Alt = fine), or click to type'
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => finishDrag(false)}
        onPointerCancel={() => finishDrag(true)}
        className={`${UI_TOKENS.inspector.scrubPill} ${
          dragPreviewVal !== null
            ? UI_TOKENS.inspector.scrubPillActive
            : disabled
            ? UI_TOKENS.inspector.scrubPillDisabled
            : UI_TOKENS.inspector.scrubPillIdle
        }`}
      >
        {label && (
          <span className={`text-[10px] font-bold ${labelClassName}`}>
            {label}
          </span>
        )}
        <span className="font-medium">
          {prefix ?? ''}
          {formatted}
          {unit ? (
            <span className="text-[10px] text-text-muted ml-0.5">{unit}</span>
          ) : null}
        </span>
      </div>
    );
  }
);
