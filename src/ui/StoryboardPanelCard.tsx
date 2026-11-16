/**
 * Shot card inside the Storyboard Contact Sheet preview.
 * Memoized to avoid re-rendering completed shots as remaining frames stream in.
 * Adapts card orientation automatically:
 * - Landscape (>= 1.0): Frame(s) on top + Eyebrow/Title/Pills footer below
 * - Portrait (< 0.99, annotated): Horizontal [Frame(s) Left | Metadata Right] split
 *   to keep tall vertical frames compact and readable.
 */

import React, { memo } from 'react';
import { Loader2 } from 'lucide-react';
import type { ExportTargetCamera } from '../core/exportMath';
import {
  formatStoryboardShotMeta,
  type StoryboardDensity,
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
  isPortrait: boolean;
  effectiveDensity: StoryboardDensity;
}

const BEAT_BADGE_CLASS: Record<'START' | 'MID' | 'END', string> = {
  START: 'bg-emerald-500/90 text-white border-emerald-400/60',
  MID: 'bg-sky-500/90 text-white border-sky-400/60',
  END: 'bg-amber-500/90 text-white border-amber-400/60',
};

const PORTRAIT_SINGLE_WIDTH_CLASS: Record<StoryboardDensity, string> = {
  compact: 'w-[104px] sm:w-[114px]',
  balanced: 'w-[124px] sm:w-[136px]',
  large: 'w-[152px] sm:w-[168px]',
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
  className?: string;
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
  className = 'w-full',
}) => (
  <div
    className={`relative bg-surface-muted overflow-hidden ${className} ${
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
        className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider shadow-xs border ${
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
    isPortrait,
    effectiveDensity,
  }) => {
    const meta = formatStoryboardShotMeta(group.samples, targetCamera);
    const shotBadge = `#${String(meta.shotNumber).padStart(2, '0')}`;
    const frameCount = group.samples.length;

    const isStartEndPair = layoutMode === 'start-end' && frameCount === 2;
    const isTripleStrip = layoutMode === 'single-row' && frameCount >= 3;
    const isPortraitHorizontalCard = isPortrait && annotated;
    const isLandscapeHorizontalStaticRow =
      !isPortrait && layoutMode === 'single-row' && frameCount === 1;
    const isHorizontalSplit =
      isPortraitHorizontalCard || isLandscapeHorizontalStaticRow;

    const cardSpanClass = isStartEndPair ? 'sm:col-span-2' : 'col-span-1';

    const showDuration = isHorizontalSplit;
    const footerContent = annotated ? (
      <div
        className={`p-2.5 bg-surface flex-1 min-w-0 flex flex-col ${
          isHorizontalSplit
            ? 'sm:p-3 justify-start gap-2 border-t sm:border-t-0 sm:border-l border-border-subtle'
            : 'justify-between gap-1.5 border-t border-border-subtle'
        }`}
      >
        <div className="space-y-1 min-w-0">
          {/* Eyebrow: Shot # + Timecode */}
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
              {shotBadge}
            </span>
            <span
              className="text-[10px] font-mono text-text-faint shrink-0"
              title={`Duration: ${meta.durationText}`}
            >
              {showDuration
                ? `${meta.timeRangeText} (${meta.durationText})`
                : meta.timeRangeText}
            </span>
          </div>

          {/* Dedicated Full-Width Shot Title */}
          <h3
            className="text-xs font-bold text-text-main truncate"
            title={meta.label}
          >
            {meta.label}
          </h3>

          {/* Full-Width Optics & Rig Pills */}
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono text-text-muted pt-0.5">
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
        </div>

        {meta.description && (
          <p
            className={`text-[11px] font-sans text-text-muted leading-snug ${
              isHorizontalSplit ? 'line-clamp-4' : 'line-clamp-2'
            }`}
            title={meta.description}
          >
            {meta.description}
          </p>
        )}
      </div>
    ) : null;

    // Portrait media frame container (sits on the left of the split card)
    const renderPortraitFrames = () => {
      if (isTripleStrip) {
        return (
          <div className="p-2 bg-surface-subtle/40 flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0">
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
                className="w-[108px] sm:w-[122px] shrink-0"
              />
            ))}
          </div>
        );
      }

      if (isStartEndPair) {
        return (
          <div className="p-2 bg-surface-subtle/40 flex items-center gap-1.5 shrink-0">
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
                className="w-[116px] sm:w-[130px] shrink-0"
              />
            ))}
          </div>
        );
      }

      const widthClass =
        layoutMode === 'single-row'
          ? PORTRAIT_SINGLE_WIDTH_CLASS.large
          : PORTRAIT_SINGLE_WIDTH_CLASS[effectiveDensity];

      return (
        <div className="p-2 bg-surface-subtle/40 flex items-center justify-center shrink-0">
          <FrameTile
            sample={group.samples[0]}
            panel={panelsByKey.get(group.samples[0].key)}
            shotBadge={shotBadge}
            label={meta.label}
            width={width}
            height={height}
            annotated={annotated}
            guideMode={guideMode}
            rounded
            className={`${widthClass} shrink-0`}
          />
        </div>
      );
    };

    const renderStandardFrames = () => {
      if (isTripleStrip) {
        return (
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
        );
      }

      if (isStartEndPair) {
        return (
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
        );
      }

      return (
        <div
          className={
            isLandscapeHorizontalStaticRow
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
            rounded={isLandscapeHorizontalStaticRow}
          />
        </div>
      );
    };

    return (
      <article
        className={`${cardSpanClass} rounded-xl border border-border-main bg-surface overflow-hidden shadow-2xs flex ${
          isHorizontalSplit ? 'flex-col sm:flex-row' : 'flex-col'
        }`}
        title={
          annotated
            ? undefined
            : `${shotBadge} · ${meta.label} (${meta.timeRangeText})`
        }
      >
        {isPortraitHorizontalCard
          ? renderPortraitFrames()
          : renderStandardFrames()}
        {footerContent}
      </article>
    );
  }
);

StoryboardPanelCard.displayName = 'StoryboardPanelCard';
