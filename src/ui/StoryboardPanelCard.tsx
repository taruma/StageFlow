/**
 * Shot card inside the Storyboard Contact Sheet preview.
 * Memoized to avoid re-rendering completed shots as remaining frames stream in.
 * Supports single-frame cards, grouped Start & End cards (col-span-2),
 * and full-row Start·Mid·End strips with instant CSS composition guides.
 */

import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';
import type { ExportTargetCamera } from '../core/exportMath';
import {
  formatStoryboardShotMeta,
  type StoryboardGuideMode,
  type StoryboardSamplePoint,
  type StoryboardShotGroup,
} from '../core/storyboardMath';
import type { StoryboardRenderedPanel } from '../hooks/useStoryboardGenerator';
import { StoryboardGuideOverlay } from './StoryboardGuideOverlay';

export type StoryboardCardLayoutMode = 'grid' | 'start-end' | 'single-row';

export interface StoryboardPanelCardProps {
  group: StoryboardShotGroup;
  panelsByKey: Map<string, StoryboardRenderedPanel>;
  width: number;
  height: number;
  targetCamera: ExportTargetCamera;
  annotated: boolean;
  guideMode: StoryboardGuideMode;
  layoutMode: StoryboardCardLayoutMode;
}

const BEAT_BADGE_CLASS: Record<'START' | 'MID' | 'END', string> = {
  START: 'bg-emerald-500/90 text-white border-emerald-400/60',
  MID: 'bg-sky-500/90 text-white border-sky-400/60',
  END: 'bg-amber-500/90 text-white border-amber-400/60',
};

const FrameTile: React.FC<{
  sample: StoryboardSamplePoint;
  panel?: StoryboardRenderedPanel;
  shotBadge: string;
  label: string;
  width: number;
  height: number;
  annotated: boolean;
  guideMode: StoryboardGuideMode;
  rounded?: boolean;
}> = ({
  sample,
  panel,
  shotBadge,
  label,
  width,
  height,
  annotated,
  guideMode,
  rounded = false,
}) => (
  <div
    className={`relative w-full bg-surface-muted overflow-hidden ${
      rounded ? 'rounded-lg border border-border-subtle' : ''
    }`}
    style={{ aspectRatio: `${width} / ${height}` }}
  >
    {panel ? (
      <img
        src={panel.imageUrl}
        alt={`${shotBadge} ${label}${
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
          {sample.beatTag ? ` · ${sample.beatTag}` : ''}
        </span>
      </div>
    )}

    <StoryboardGuideOverlay guideMode={guideMode} />

    {annotated && sample.beatTag && (
      <span
        className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider shadow-xs border ${
          BEAT_BADGE_CLASS[sample.beatTag]
        }`}
      >
        {sample.beatTag} · {sample.stageTimeSec.toFixed(1)}s
      </span>
    )}
  </div>
);

export const StoryboardPanelCard: React.FC<StoryboardPanelCardProps> = memo(
  ({
    group,
    panelsByKey,
    width,
    height,
    targetCamera,
    annotated,
    guideMode,
    layoutMode,
  }) => {
    const meta = formatStoryboardShotMeta(group.samples, targetCamera);
    const shotBadge = `#${String(meta.shotNumber).padStart(2, '0')}`;
    const frameCount = group.samples.length;

    const isHorizontalStaticRow =
      layoutMode === 'single-row' && frameCount === 1;
    const isStartEndPair = layoutMode === 'start-end' && frameCount === 2;
    const isTripleStrip = layoutMode === 'single-row' && frameCount >= 3;

    const cardSpanClass = isStartEndPair ? 'sm:col-span-2' : 'col-span-1';

    const footerContent = annotated ? (
      <div
        className={`p-2.5 space-y-1.5 bg-surface flex-1 flex flex-col justify-between ${
          isHorizontalStaticRow
            ? 'sm:p-3.5 border-t sm:border-t-0 sm:border-l border-border-subtle'
            : 'border-t border-border-subtle'
        }`}
      >
        <div className="space-y-1">
          <div
            className="flex items-baseline gap-1.5 min-w-0"
            title={`${shotBadge} · ${meta.label}`}
          >
            <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
              {shotBadge}
            </span>
            <h3 className="text-xs font-bold text-text-main truncate">
              {meta.label}
            </h3>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] font-mono text-text-muted">
            <div className="flex flex-wrap items-center gap-1 min-w-0">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-body">
                {meta.rigText && (
                  <>
                    <span className="text-sky-600 dark:text-sky-400 font-semibold">
                      {meta.rigText}
                    </span>
                    <span className="text-text-faint">·</span>
                  </>
                )}
                <span>{meta.focalLengthText}</span>
                <span className="text-text-faint">·</span>
                <span>{meta.maneuverText}</span>
              </span>

              {(meta.apertureText || meta.focusText) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300">
                  {meta.apertureText && <span>{meta.apertureText}</span>}
                  {meta.apertureText && meta.focusText && (
                    <span className="opacity-50">·</span>
                  )}
                  {meta.focusText && <span>{meta.focusText}</span>}
                </span>
              )}
            </div>

            <span
              className="text-text-faint shrink-0"
              title={`Duration: ${meta.durationText}`}
            >
              {meta.timeRangeText}
            </span>
          </div>
        </div>

        {meta.description && (
          <p
            className={`text-[11px] font-sans text-text-muted leading-snug ${
              isHorizontalStaticRow ? 'line-clamp-4' : 'line-clamp-2'
            }`}
            title={meta.description}
          >
            {meta.description}
          </p>
        )}
      </div>
    ) : null;

    return (
      <article
        className={`${cardSpanClass} rounded-xl border border-border-main bg-surface overflow-hidden shadow-2xs flex ${
          isHorizontalStaticRow ? 'flex-col sm:flex-row' : 'flex-col'
        }`}
        title={
          annotated
            ? undefined
            : `${shotBadge} · ${meta.label} (${meta.timeRangeText})`
        }
      >
        {isTripleStrip ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 bg-surface-subtle/40">
            {group.samples.map((sample) => (
              <FrameTile
                key={sample.key}
                sample={sample}
                panel={panelsByKey.get(sample.key)}
                shotBadge={shotBadge}
                label={meta.label}
                width={width}
                height={height}
                annotated={annotated}
                guideMode={guideMode}
                rounded
              />
            ))}
          </div>
        ) : isStartEndPair ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 bg-surface-subtle/40">
            {group.samples.map((sample) => (
              <FrameTile
                key={sample.key}
                sample={sample}
                panel={panelsByKey.get(sample.key)}
                shotBadge={shotBadge}
                label={meta.label}
                width={width}
                height={height}
                annotated={annotated}
                guideMode={guideMode}
                rounded
              />
            ))}
          </div>
        ) : (
          <div
            className={
              isHorizontalStaticRow
                ? 'w-full sm:w-1/3 shrink-0 p-2 bg-surface-subtle/40 flex items-center'
                : 'w-full'
            }
          >
            <FrameTile
              sample={group.samples[0]}
              panel={panelsByKey.get(group.samples[0].key)}
              shotBadge={shotBadge}
              label={meta.label}
              width={width}
              height={height}
              annotated={annotated}
              guideMode={guideMode}
              rounded={isHorizontalStaticRow}
            />
          </div>
        )}

        {footerContent}
      </article>
    );
  }
);

StoryboardPanelCard.displayName = 'StoryboardPanelCard';
