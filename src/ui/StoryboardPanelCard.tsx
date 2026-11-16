/**
 * Single panel card inside the Storyboard Contact Sheet preview grid.
 * Displays either a streamed PNG <img> or a loading skeleton, with optional
 * directorial metadata footer (shot #, label, timecode, lens, maneuver, notes).
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { ExportTargetCamera } from '../core/exportMath';
import {
  formatStoryboardPanelMeta,
  type StoryboardSamplePoint,
} from '../core/storyboardMath';
import type { StoryboardRenderedPanel } from '../hooks/useStoryboardGenerator';

export interface StoryboardPanelCardProps {
  sample: StoryboardSamplePoint;
  panel?: StoryboardRenderedPanel;
  width: number;
  height: number;
  targetCamera: ExportTargetCamera;
  annotated: boolean;
}

export const StoryboardPanelCard: React.FC<StoryboardPanelCardProps> = ({
  sample,
  panel,
  width,
  height,
  targetCamera,
  annotated,
}) => {
  const meta = formatStoryboardPanelMeta(sample, targetCamera);
  const shotBadge = `#${String(meta.shotNumber).padStart(2, '0')}`;

  return (
    <article
      className="rounded-xl border border-border-main bg-surface overflow-hidden shadow-2xs flex flex-col"
      title={
        annotated
          ? undefined
          : `${shotBadge} · ${meta.label} (${meta.timeRangeText})`
      }
    >
      {/* Frame Image / Pending Placeholder */}
      <div
        className="relative w-full bg-surface-muted overflow-hidden"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {panel ? (
          <img
            src={panel.imageUrl}
            alt={`${shotBadge} ${meta.label}${
              sample.beatTag ? ` (${sample.beatTag})` : ''
            }`}
            className="w-full h-full object-cover block select-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-text-faint animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-wider">
              {shotBadge}
            </span>
          </div>
        )}

        {annotated && sample.beatTag && (
          <span
            className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider shadow-xs border ${
              sample.beatTag === 'START'
                ? 'bg-emerald-500/90 text-white border-emerald-400/60'
                : 'bg-amber-500/90 text-white border-amber-400/60'
            }`}
          >
            {sample.beatTag}
          </span>
        )}
      </div>

      {/* Directorial Metadata Footer */}
      {annotated && (
        <div className="p-2.5 space-y-1.5 border-t border-border-subtle bg-surface flex-1 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                  {shotBadge}
                </span>
                <h3 className="text-xs font-bold text-text-main truncate">
                  {meta.label}
                </h3>
              </div>
              <span className="text-[10px] font-mono text-text-faint shrink-0">
                {meta.timeRangeText}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-text-muted">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-body">
                <span>{meta.focalLengthText}</span>
                <span className="text-text-faint">·</span>
                <span>{meta.maneuverText}</span>
              </span>
              <span className="text-text-faint">{meta.durationText}</span>
            </div>
          </div>

          {meta.description && (
            <p
              className="text-[11px] font-sans text-text-muted leading-snug line-clamp-2"
              title={meta.description}
            >
              {meta.description}
            </p>
          )}
        </div>
      )}
    </article>
  );
};
