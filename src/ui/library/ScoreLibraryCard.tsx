/**
 * ScoreLibraryCard Component for ScoreLibraryModal & MobileScoreLibraryModal.
 * Ultra-compact 2-line card (~46px) optimized for dense 3-column desktop grids:
 * Line 1: Category tag + Title + Active badge / hover Inspect trigger
 * Line 2: Compact telemetry (Media · Duration · Shots · Aspect)
 */

import React from 'react';
import { Check, Film, Camera, Video, Info } from 'lucide-react';
import type { ScoreCatalogItem } from '../../core/scoreCatalog';
import { formatScoreAspectRatio } from '../../core/scoreCatalogFilters';

export interface ScoreLibraryCardProps {
  item: ScoreCatalogItem;
  isActive: boolean;
  isSelected?: boolean;
  onSelect: () => void;
  onDoubleClick?: () => void;
  onInspect?: () => void;
}

interface BlueprintBadgeInfo {
  tag: string;
  badgeClass: string;
  accentBorder: string;
}

function getScoreBadgeInfo(item: ScoreCatalogItem): BlueprintBadgeInfo {
  if (item.category === 'custom' || item.isCustom) {
    return {
      tag: 'CUSTOM',
      badgeClass:
        'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-400/30',
      accentBorder: 'border-l-amber-500',
    };
  }

  if (item.category === 'study') {
    return {
      tag: 'STUDY',
      badgeClass:
        'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-400/30',
      accentBorder: 'border-l-violet-500',
    };
  }

  let tag = 'BP';
  if (item.id === 'demo' || item.id === 'demo-blueprint') {
    tag = 'BP 01';
  } else {
    const match = item.id.match(/(?:blueprint[_-]?0?(\d+))/i);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      tag = `BP ${num < 10 ? `0${num}` : num}`;
    }
  }

  return {
    tag,
    badgeClass:
      'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-400/30',
    accentBorder: 'border-l-sky-500',
  };
}

function getMediaSourceBadge(videoUrl?: string) {
  if (!videoUrl || videoUrl.startsWith('procedural://')) {
    return {
      label: 'Sim',
      icon: Camera,
      className: 'text-cyan-600 dark:text-cyan-400',
    };
  }
  if (
    videoUrl.startsWith('youtube://') ||
    videoUrl.includes('youtube.com') ||
    videoUrl.includes('youtu.be')
  ) {
    return {
      label: 'YT',
      icon: Film,
      className: 'text-rose-600 dark:text-rose-400',
    };
  }
  return {
    label: 'Video',
    icon: Video,
    className: 'text-amber-600 dark:text-amber-400',
  };
}

export const ScoreLibraryCard: React.FC<ScoreLibraryCardProps> = ({
  item,
  isActive,
  isSelected = false,
  onSelect,
  onDoubleClick,
  onInspect,
}) => {
  const badgeInfo = getScoreBadgeInfo(item);
  const mediaBadge = getMediaSourceBadge(item.videoUrl);
  const MediaIcon = mediaBadge.icon;
  const hoverTooltip = item.subtitle
    ? `${item.title} — ${item.subtitle}`
    : item.title;

  return (
    <div
      role="button"
      tabIndex={0}
      data-score-id={item.id}
      title={hoverTooltip}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`px-2.5 py-1.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 group relative select-none border-l-[3px] ${badgeInfo.accentBorder} ${
        isSelected
          ? 'border-border-main bg-surface-subtle ring-1 ring-text-main/25 shadow-xs'
          : 'border-border-subtle bg-surface hover:bg-surface-subtle'
      }`}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        {/* Line 1: Tag + Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 uppercase tracking-wider ${badgeInfo.badgeClass}`}
          >
            {badgeInfo.tag}
          </span>

          <h3 className="text-xs font-semibold font-sans text-text-main truncate">
            {item.title}
          </h3>
        </div>

        {/* Line 2: Compact Telemetry */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted truncate">
          <span
            className={`inline-flex items-center gap-0.5 ${mediaBadge.className} shrink-0`}
          >
            <MediaIcon className="w-2.5 h-2.5" />
            <span>{mediaBadge.label}</span>
          </span>

          <span className="text-text-faint opacity-50">·</span>
          <span className="shrink-0">{item.durationSec.toFixed(1)}s</span>

          <span className="text-text-faint opacity-50">·</span>
          <span className="shrink-0">{item.shotCount}sh</span>

          <span className="text-text-faint opacity-50">·</span>
          <span className="shrink-0">
            {formatScoreAspectRatio(item.aspectRatio)}
          </span>
        </div>
      </div>

      {/* Right Column: Active Pill + Optional Hover Inspect Trigger */}
      <div className="shrink-0 flex items-center gap-1">
        {isActive && (
          <span
            title="Loaded in Studio"
            className="inline-flex items-center gap-0.5 text-[8.5px] font-mono font-bold bg-btn-primary-bg text-btn-primary-text px-1.5 py-0.2 rounded-full shadow-2xs"
          >
            <Check className="w-2.5 h-2.5" />
            <span className="hidden sm:inline">Active</span>
          </span>
        )}

        {onInspect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            aria-label={`Inspect ${item.title}`}
            title="Inspect score details"
            className={`p-1 rounded-lg transition-opacity cursor-pointer ${
              isSelected
                ? 'opacity-80 hover:opacity-100 text-text-muted hover:text-text-main hover:bg-surface'
                : 'opacity-0 group-hover:opacity-80 hover:opacity-100 text-text-faint hover:text-text-main hover:bg-surface'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
