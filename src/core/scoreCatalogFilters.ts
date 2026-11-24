/**
 * Pure Layer 1 filter, sort, and display formatting utilities for the Score Library.
 * Evaluates exclusively against lightweight `ScoreCatalogItem` metadata without parsing YAML.
 * Zero React and zero DOM/Three.js runtime dependencies.
 */

import { parseIsoDateToEpochMs, type ScoreCatalogItem } from './scoreCatalog';
import type {
  LibraryAspectFilter,
  LibraryFilterTab,
  LibrarySortDirection,
  LibrarySortField,
  LibrarySourceFilter,
} from './types';

export interface ScoreCatalogFilterOptions {
  tab: LibraryFilterTab;
  query: string;
  source: LibrarySourceFilter;
  aspect: LibraryAspectFilter;
}

/**
 * Classifies a score's media URL into `'youtube'` or `'other'` (Simulator / Local video).
 */
export function classifyScoreMediaSource(videoUrl?: string): 'youtube' | 'other' {
  if (!videoUrl) return 'other';
  const normalized = videoUrl.toLowerCase();
  if (
    normalized.startsWith('youtube://') ||
    normalized.includes('youtube.com') ||
    normalized.includes('youtu.be')
  ) {
    return 'youtube';
  }
  return 'other';
}

/**
 * Classifies a numeric aspect ratio into `'16:9'`, `'scope'` (2.39:1 / 21:9), or `'other'`.
 */
export function classifyScoreAspectBucket(
  aspectRatio?: number
): '16:9' | 'scope' | 'other' {
  if (!aspectRatio || !Number.isFinite(aspectRatio)) return '16:9';
  if (Math.abs(aspectRatio - 16 / 9) < 0.08) return '16:9';
  if (aspectRatio >= 2.15) return 'scope';
  return 'other';
}

/**
 * Formats a numeric or string aspect ratio into a concise film-gate label.
 */
export function formatScoreAspectRatio(ratio: number | string | undefined): string {
  if (typeof ratio === 'string') return ratio;
  if (!ratio || Number.isNaN(ratio)) return '16:9';
  if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9';
  if (Math.abs(ratio - 21 / 9) < 0.02) return '21:9';
  if (Math.abs(ratio - 2.39) < 0.05 || Math.abs(ratio - 2.35) < 0.05) {
    return '2.39:1';
  }
  if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
  if (Math.abs(ratio - 1) < 0.05) return '1:1';
  if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16';
  return `${ratio.toFixed(2)}:1`;
}

/**
 * Returns the default sort direction for a given sort field.
 */
export function getDefaultSortDirection(
  field: LibrarySortField
): LibrarySortDirection {
  return field === 'title' ? 'asc' : 'desc';
}

/**
 * Resolves a score's recency timestamp in epoch ms (`updatedAt` or catalog `date`), or `null` if undated.
 */
export function getScoreRecencyMs(item: ScoreCatalogItem): number | null {
  if (
    typeof item.updatedAt === 'number' &&
    Number.isFinite(item.updatedAt) &&
    item.updatedAt > 0
  ) {
    return item.updatedAt;
  }
  const parsed = parseIsoDateToEpochMs(item.date);
  return parsed !== undefined ? parsed : null;
}

/**
 * Filters a catalog list by category tab, media source, aspect bucket, and search query.
 */
export function filterScoreCatalog(
  items: ScoreCatalogItem[],
  options: ScoreCatalogFilterOptions
): ScoreCatalogItem[] {
  const query = options.query.trim().toLowerCase();

  return items.filter((item) => {
    if (options.tab === 'study' && item.category !== 'study') return false;
    if (options.tab === 'blueprint' && item.category !== 'blueprint') return false;
    if (
      options.tab === 'custom' &&
      item.category !== 'custom' &&
      !item.isCustom
    ) {
      return false;
    }

    if (
      options.source !== 'all' &&
      classifyScoreMediaSource(item.videoUrl) !== options.source
    ) {
      return false;
    }

    if (
      options.aspect !== 'all' &&
      classifyScoreAspectBucket(item.aspectRatio) !== options.aspect
    ) {
      return false;
    }

    if (query.length > 0) {
      const matchesTitle = item.title.toLowerCase().includes(query);
      const matchesSubtitle =
        typeof item.subtitle === 'string' &&
        item.subtitle.toLowerCase().includes(query);
      const matchesId = item.id.toLowerCase().includes(query);
      const matchesAlias =
        Array.isArray(item.aliases) &&
        item.aliases.some((alias) => alias.toLowerCase().includes(query));

      if (!matchesTitle && !matchesSubtitle && !matchesId && !matchesAlias) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Returns a new deterministically sorted array of catalog items without mutating the input.
 * For `'recent'`, undated items (such as Blueprints) always follow dated items in original order.
 */
export function sortScoreCatalog(
  items: ScoreCatalogItem[],
  field: LibrarySortField,
  direction: LibrarySortDirection
): ScoreCatalogItem[] {
  const dir = direction === 'asc' ? 1 : -1;

  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      if (field === 'recent') {
        const tsA = getScoreRecencyMs(a.item);
        const tsB = getScoreRecencyMs(b.item);
        if (tsA !== null && tsB !== null) {
          if (tsA !== tsB) return (tsA - tsB) * dir;
          return a.item.title.localeCompare(b.item.title);
        }
        if (tsA !== null) return -1;
        if (tsB !== null) return 1;
        return a.index - b.index;
      }

      if (field === 'title') {
        const cmp = a.item.title.localeCompare(b.item.title);
        if (cmp !== 0) return cmp * dir;
        return a.index - b.index;
      }

      if (field === 'duration') {
        const diff = a.item.durationSec - b.item.durationSec;
        if (diff !== 0) return diff * dir;
        return a.item.title.localeCompare(b.item.title);
      }

      const shotDiff = a.item.shotCount - b.item.shotCount;
      if (shotDiff !== 0) return shotDiff * dir;
      return a.item.title.localeCompare(b.item.title);
    })
    .map((entry) => entry.item);
}

/**
 * Returns `true` when any search text or source/aspect filter is active.
 */
export function hasActiveLibraryFilters(
  options: Omit<ScoreCatalogFilterOptions, 'tab'>
): boolean {
  return (
    options.query.trim().length > 0 ||
    options.source !== 'all' ||
    options.aspect !== 'all'
  );
}

/**
 * Formats a concise `YYYY-MM-DD` date string for display in the Inspector header when available.
 */
export function formatScoreDateLabel(item: ScoreCatalogItem): string | null {
  if (item.date) return item.date;
  if (
    item.isCustom &&
    typeof item.updatedAt === 'number' &&
    Number.isFinite(item.updatedAt) &&
    item.updatedAt > 0
  ) {
    const dt = new Date(item.updatedAt);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}
