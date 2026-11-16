/**
 * Shot card inside the Storyboard Contact Sheet preview.
 * Uses a traditional film contact-sheet aesthetic: minimal corner slate overlays
 * on frames paired with a hairline-ruled technical spec table below (or beside
 * portrait frames) and directorial action notes.
 */

import React, { memo } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type {
  ExportResolutionTier,
  ExportTargetCamera,
} from '../core/exportMath';
import {
  formatStoryboardShotMeta,
  type StoryboardDensity,
  type StoryboardExportFormat,
  type StoryboardGuideMode,
  type StoryboardSamplePoint,
  type StoryboardShotGroup,
} from '../core/storyboardMath';
import type {
  StoryboardRenderedPanel,
} from '../hooks/useStoryboardGenerator';
import type { ObserverShotCue } from '../core/types';
import { StoryboardGuideOverlay } from './StoryboardGuideOverlay';

export type StoryboardCardLayoutMode = 'grid' | 'start-end' | 'single-row';

export interface StoryboardPanelCardProps {
  group: StoryboardShotGroup;
  panelsByKey: Map<string, StoryboardRenderedPanel>;
  width: number;
  height: number;
  targetCamera: ExportTargetCamera;
  observerShots?: ObserverShotCue[];
  annotated: boolean;
  guideMode: StoryboardGuideMode;
  layoutMode: StoryboardCardLayoutMode;
  isPortrait: boolean;
  effectiveDensity: StoryboardDensity;
  downloadingKey?: string | null;
  exportTier?: ExportResolutionTier;
  exportFormat?: StoryboardExportFormat;
  onExportSample?: (sample: StoryboardSamplePoint) => void;
}

const BEAT_DOT_CLASS: Record<'START' | 'MID' | 'END', string> = {
  START: 'bg-emerald-400',
  MID: 'bg-sky-400',
  END: 'bg-amber-400',
};

const PORTRAIT_SINGLE_WIDTH_CLASS: Record<StoryboardDensity, string> = {
  compact: 'w-[110px] sm:w-[120px]',
  balanced: 'w-[132px] sm:w-[144px]',
  large: 'w-[158px] sm:w-[176px]',
};

interface TechSpecItem {
  label: string;
  value: string;
  tooltip: string;
  spanFull?: boolean;
}

const FrameTile: React.FC<{
  sample: StoryboardSamplePoint;
  panel?: StoryboardRenderedPanel;
  shotBadge: string;
  label: string;
  singleTimeStamp: string;
  width: number;
  height: number;
  annotated: boolean;
  guideMode: StoryboardGuideMode;
  rounded?: boolean;
  className?: string;
  downloadingKey?: string | null;
  exportLabel?: string;
  onExportSample?: (sample: StoryboardSamplePoint) => void;
}> = ({
  sample,
  panel,
  shotBadge,
  label,
  singleTimeStamp,
  width,
  height,
  annotated,
  guideMode,
  rounded = false,
  className = 'w-full',
  downloadingKey,
  exportLabel = '1080p PNG',
  onExportSample,
}) => {
  const isDownloadingThis = downloadingKey === sample.key;
  const isExportBusy = Boolean(downloadingKey);

  return (
    <div
      className={`group/tile relative bg-surface-muted overflow-hidden ${className} ${
        rounded ? 'rounded-md border border-border-subtle' : ''
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

      {annotated && (
        <>
          {/* Top-Left Minimal Slate Stamp */}
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] bg-slate-950/75 backdrop-blur-[2px] border border-white/15 text-[9.5px] font-mono font-bold tracking-wider text-white/95 shadow-2xs pointer-events-none select-none">
            {sample.beatTag ? (
              <>
                <span
                  className={`w-1.5 h-1.5 rounded-full ${BEAT_DOT_CLASS[sample.beatTag]}`}
                />
                <span>
                  {shotBadge} · {sample.beatTag}
                </span>
              </>
            ) : (
              <span>{shotBadge}</span>
            )}
          </span>

          {/* Top-Right Timecode Slate Stamp */}
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-[3px] bg-slate-950/70 backdrop-blur-[2px] border border-white/15 text-[9px] font-mono tracking-tight text-white/90 shadow-2xs pointer-events-none select-none">
            {sample.beatTag
              ? `@ ${sample.stageTimeSec.toFixed(1)}s`
              : singleTimeStamp}
          </span>
        </>
      )}

      {/* Small Bottom-Right Single-Frame Download Button */}
      {onExportSample && panel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExportSample(sample);
          }}
          disabled={isExportBusy}
          title={`Download ${shotBadge}${
            sample.beatTag ? ` ${sample.beatTag}` : ''
          } (${exportLabel})`}
          aria-label={`Download ${shotBadge} frame as ${exportLabel}`}
          className={`absolute bottom-1.5 right-1.5 w-6 h-6 rounded-[4px] bg-slate-950/75 hover:bg-slate-950/95 border border-white/20 text-white/90 hover:text-white flex items-center justify-center shadow-sm backdrop-blur-[2px] transition-all cursor-pointer disabled:cursor-wait ${
            isDownloadingThis
              ? 'opacity-100'
              : 'opacity-70 group-hover/tile:opacity-100 disabled:opacity-35'
          }`}
        >
          {isDownloadingThis ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
};

export const StoryboardPanelCard: React.FC<StoryboardPanelCardProps> = memo(
  ({
    group,
    panelsByKey,
    width,
    height,
    targetCamera,
    observerShots,
    annotated,
    guideMode,
    layoutMode,
    isPortrait,
    effectiveDensity,
    downloadingKey,
    exportTier = 1080,
    exportFormat = 'png',
    onExportSample,
  }) => {
    const meta = formatStoryboardShotMeta(
      group.samples,
      targetCamera,
      observerShots
    );
    const shotBadge = `#${String(meta.shotNumber).padStart(2, '0')}`;
    const frameCount = group.samples.length;
    const singleTimeStamp = `${meta.timeRangeText} (${meta.durationText})`;
    const exportLabel = `${exportTier}p ${
      exportFormat === 'jpeg' ? 'JPG' : exportFormat.toUpperCase()
    }`;

    const isStartEndPair = layoutMode === 'start-end' && frameCount === 2;
    const isTripleStrip = layoutMode === 'single-row' && frameCount >= 3;
    const isPortraitHorizontalCard = isPortrait && annotated;
    const isLandscapeHorizontalStaticRow =
      !isPortrait && layoutMode === 'single-row' && frameCount === 1;
    const isHorizontalSplit =
      isPortraitHorizontalCard || isLandscapeHorizontalStaticRow;

    const cardSpanClass = isStartEndPair ? 'sm:col-span-2' : 'col-span-1';

    const specItems: TechSpecItem[] = [
      {
        label: 'TARGET',
        value: meta.targetText,
        tooltip: meta.targetTooltip,
        spanFull: !meta.rigText,
      },
      ...(meta.rigText
        ? [
            {
              label: 'RIG',
              value: meta.rigText,
              tooltip: meta.rigTooltip ?? `Physical Camera Mount: ${meta.rigText}`,
            },
          ]
        : []),
      { label: 'CAM', value: meta.cameraText, tooltip: meta.cameraTooltip },
      { label: 'MOVE', value: meta.moveText, tooltip: meta.moveTooltip },
      {
        label: 'OPTICS',
        value: meta.opticsText,
        tooltip: meta.opticsTooltip,
        spanFull: !meta.focusText,
      },
      ...(meta.focusText
        ? [
            {
              label: 'FOCUS',
              value: meta.focusText,
              tooltip: meta.focusTooltip ?? `Focus Depth: ${meta.focusText}`,
            },
          ]
        : []),
      ...(meta.observerText
        ? [
            {
              label: 'OBS',
              value: meta.observerText,
              tooltip:
                meta.observerTooltip ??
                `Observer Diorama Camera: ${meta.observerText}`,
              spanFull: true,
            },
          ]
        : []),
    ];

    const footerContent = annotated ? (
      <div
        className={`p-2.5 bg-surface flex-1 min-w-0 flex flex-col gap-2 ${
          isHorizontalSplit
            ? 'sm:p-3 justify-start border-t sm:border-t-0 sm:border-l border-border-subtle'
            : 'justify-between border-t border-border-subtle'
        }`}
      >
        <div className="space-y-2 min-w-0">
          {/* Shot Title (+ Shot Window when multi-beat frames show @ timestamps) */}
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <h3
              className="text-xs font-bold text-text-main truncate"
              title={meta.label}
            >
              {meta.label}
            </h3>
            {frameCount > 1 && (
              <span className="text-[10px] font-mono text-text-faint shrink-0">
                {singleTimeStamp}
              </span>
            )}
          </div>

          {/* Traditional Hairline Technical Spec Table */}
          <div className="border-y border-border-subtle py-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] font-mono">
            {specItems.map((item) => (
              <div
                key={item.label}
                className={`flex items-baseline gap-1 min-w-0 cursor-help ${
                  item.spanFull ? 'col-span-2' : ''
                }`}
                title={item.tooltip}
              >
                <span className="text-[8px] uppercase tracking-wider text-text-faint shrink-0 w-[34px]">
                  {item.label}
                </span>
                <span className="text-text-body truncate">{item.value}</span>
              </div>
            ))}
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

    const renderFrameTile = (
      sample: StoryboardSamplePoint,
      tileProps: { rounded?: boolean; className?: string } = {}
    ) => (
      <FrameTile
        key={sample.key}
        sample={sample}
        panel={panelsByKey.get(sample.key)}
        shotBadge={shotBadge}
        label={meta.label}
        singleTimeStamp={singleTimeStamp}
        width={width}
        height={height}
        annotated={annotated}
        guideMode={guideMode}
        rounded={tileProps.rounded}
        className={tileProps.className}
        downloadingKey={downloadingKey}
        exportLabel={exportLabel}
        onExportSample={onExportSample}
      />
    );

    const renderPortraitFrames = () => {
      if (isTripleStrip) {
        return (
          <div className="p-2 bg-surface-subtle/40 flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0">
            {group.samples.map((sample) =>
              renderFrameTile(sample, {
                rounded: true,
                className: 'w-[108px] sm:w-[122px] shrink-0',
              })
            )}
          </div>
        );
      }

      if (isStartEndPair) {
        return (
          <div className="p-2 bg-surface-subtle/40 flex items-center gap-1.5 shrink-0">
            {group.samples.map((sample) =>
              renderFrameTile(sample, {
                rounded: true,
                className: 'w-[116px] sm:w-[130px] shrink-0',
              })
            )}
          </div>
        );
      }

      const widthClass =
        layoutMode === 'single-row'
          ? PORTRAIT_SINGLE_WIDTH_CLASS.large
          : PORTRAIT_SINGLE_WIDTH_CLASS[effectiveDensity];

      return (
        <div className="p-2 bg-surface-subtle/40 flex items-center justify-center shrink-0">
          {renderFrameTile(group.samples[0], {
            rounded: true,
            className: `${widthClass} shrink-0`,
          })}
        </div>
      );
    };

    const renderStandardFrames = () => {
      if (isTripleStrip) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 bg-surface-subtle/40">
            {group.samples.map((sample) =>
              renderFrameTile(sample, { rounded: true })
            )}
          </div>
        );
      }

      if (isStartEndPair) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 bg-surface-subtle/40">
            {group.samples.map((sample) =>
              renderFrameTile(sample, { rounded: true })
            )}
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
          {renderFrameTile(group.samples[0], {
            rounded: isLandscapeHorizontalStaticRow,
          })}
        </div>
      );
    };

    return (
      <article
        className={`${cardSpanClass} rounded-lg border border-border-main bg-surface overflow-hidden shadow-2xs flex ${
          isHorizontalSplit ? 'flex-col sm:flex-row' : 'flex-col'
        }`}
        title={
          annotated
            ? undefined
            : `${shotBadge} · ${meta.label} (${singleTimeStamp})`
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
