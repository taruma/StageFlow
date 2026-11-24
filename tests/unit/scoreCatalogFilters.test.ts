import { describe, expect, it } from 'vitest';
import type { ScoreCatalogItem } from '../../src/core/scoreCatalog';
import {
  classifyScoreAspectBucket,
  classifyScoreMediaSource,
  filterScoreCatalog,
  formatScoreAspectRatio,
  formatScoreDateLabel,
  getDefaultSortDirection,
  getScoreRecencyMs,
  hasActiveLibraryFilters,
  sortScoreCatalog,
} from '../../src/core/scoreCatalogFilters';

const MOCK_ITEMS: ScoreCatalogItem[] = [
  {
    id: 'custom-alpha',
    title: 'Alpha Custom Scene',
    subtitle: 'Hand-edited rooftop chase',
    category: 'custom',
    isCustom: true,
    updatedAt: Date.UTC(2026, 8, 10, 12, 0, 0),
    durationSec: 45,
    shotCount: 12,
    aspectRatio: 16 / 9,
    videoUrl: 'procedural://custom',
  },
  {
    id: 'study-beta',
    title: 'Beta Study',
    subtitle: 'Two-person diner confrontation',
    category: 'study',
    date: '2026-08-23',
    updatedAt: Date.UTC(2026, 7, 23),
    durationSec: 82.5,
    shotCount: 22,
    aspectRatio: 16 / 9,
    videoUrl: 'https://www.youtube.com/watch?v=abc123',
    aliases: ['beta-alias'],
  },
  {
    id: 'study-gamma',
    title: 'Gamma Study',
    subtitle: 'Cornfield relic activation',
    category: 'study',
    date: '2026-07-16',
    updatedAt: Date.UTC(2026, 6, 16),
    durationSec: 61.6,
    shotCount: 32,
    aspectRatio: 21 / 9,
    videoUrl: 'youtube://xyz789',
  },
  {
    id: 'blueprint-05',
    title: 'Two Rooms Threshold',
    category: 'blueprint',
    durationSec: 30,
    shotCount: 17,
    aspectRatio: 2.39,
    videoUrl: 'procedural://demo',
  },
  {
    id: 'custom-square',
    title: 'Square Testbed',
    category: 'custom',
    isCustom: true,
    updatedAt: Date.UTC(2026, 5, 1),
    durationSec: 12,
    shotCount: 4,
    aspectRatio: 1,
    videoUrl: 'blob:http://localhost/local.mp4',
  },
];

describe('scoreCatalogFilters — Pure Library Filter, Sort & Format Helpers', () => {
  it('classifies media sources into youtube vs other (simulator/local)', () => {
    expect(classifyScoreMediaSource('https://www.youtube.com/watch?v=123')).toBe('youtube');
    expect(classifyScoreMediaSource('https://youtu.be/123')).toBe('youtube');
    expect(classifyScoreMediaSource('youtube://123')).toBe('youtube');
    expect(classifyScoreMediaSource('procedural://demo')).toBe('other');
    expect(classifyScoreMediaSource('blob:http://localhost/clip.mp4')).toBe('other');
    expect(classifyScoreMediaSource(undefined)).toBe('other');
  });

  it('classifies and formats aspect ratios cleanly', () => {
    expect(classifyScoreAspectBucket(16 / 9)).toBe('16:9');
    expect(classifyScoreAspectBucket(21 / 9)).toBe('scope');
    expect(classifyScoreAspectBucket(2.39)).toBe('scope');
    expect(classifyScoreAspectBucket(1)).toBe('other');
    expect(classifyScoreAspectBucket(9 / 16)).toBe('other');

    expect(formatScoreAspectRatio(16 / 9)).toBe('16:9');
    expect(formatScoreAspectRatio(21 / 9)).toBe('21:9');
    expect(formatScoreAspectRatio(2.39)).toBe('2.39:1');
    expect(formatScoreAspectRatio(1)).toBe('1:1');
    expect(formatScoreAspectRatio(9 / 16)).toBe('9:16');
  });

  it('filters catalog items by category tab, source, aspect, and search (including aliases)', () => {
    expect(
      filterScoreCatalog(MOCK_ITEMS, {
        tab: 'all',
        query: '',
        source: 'youtube',
        aspect: 'all',
      }).map((i) => i.id)
    ).toEqual(['study-beta', 'study-gamma']);

    expect(
      filterScoreCatalog(MOCK_ITEMS, {
        tab: 'all',
        query: '',
        source: 'other',
        aspect: 'scope',
      }).map((i) => i.id)
    ).toEqual(['blueprint-05']);

    expect(
      filterScoreCatalog(MOCK_ITEMS, {
        tab: 'study',
        query: 'beta-alias',
        source: 'all',
        aspect: 'all',
      }).map((i) => i.id)
    ).toEqual(['study-beta']);

    expect(
      filterScoreCatalog(MOCK_ITEMS, {
        tab: 'custom',
        query: '',
        source: 'all',
        aspect: 'other',
      }).map((i) => i.id)
    ).toEqual(['custom-square']);

    expect(
      hasActiveLibraryFilters({ query: '', source: 'all', aspect: 'all' })
    ).toBe(false);
    expect(
      hasActiveLibraryFilters({ query: 'diner', source: 'all', aspect: 'all' })
    ).toBe(true);
  });

  it('sorts by recent with undated items trailing in original order regardless of direction', () => {
    const descIds = sortScoreCatalog(MOCK_ITEMS, 'recent', 'desc').map((i) => i.id);
    expect(descIds).toEqual([
      'custom-alpha',
      'study-beta',
      'study-gamma',
      'custom-square',
      'blueprint-05',
    ]);

    const ascIds = sortScoreCatalog(MOCK_ITEMS, 'recent', 'asc').map((i) => i.id);
    expect(ascIds).toEqual([
      'custom-square',
      'study-gamma',
      'study-beta',
      'custom-alpha',
      'blueprint-05',
    ]);
  });

  it('sorts deterministically by title, duration, and shots in both directions', () => {
    expect(getDefaultSortDirection('title')).toBe('asc');
    expect(getDefaultSortDirection('recent')).toBe('desc');
    expect(getDefaultSortDirection('duration')).toBe('desc');
    expect(getDefaultSortDirection('shots')).toBe('desc');

    expect(
      sortScoreCatalog(MOCK_ITEMS, 'title', 'asc').map((i) => i.id)
    ).toEqual([
      'custom-alpha',
      'study-beta',
      'study-gamma',
      'custom-square',
      'blueprint-05',
    ]);

    expect(
      sortScoreCatalog(MOCK_ITEMS, 'duration', 'desc').map((i) => i.id)
    ).toEqual([
      'study-beta',
      'study-gamma',
      'custom-alpha',
      'blueprint-05',
      'custom-square',
    ]);

    expect(
      sortScoreCatalog(MOCK_ITEMS, 'shots', 'asc').map((i) => i.id)
    ).toEqual([
      'custom-square',
      'custom-alpha',
      'blueprint-05',
      'study-beta',
      'study-gamma',
    ]);
  });

  it('resolves recency timestamps and display date labels cleanly', () => {
    expect(getScoreRecencyMs(MOCK_ITEMS[1])).toBe(Date.UTC(2026, 7, 23));
    expect(getScoreRecencyMs(MOCK_ITEMS[3])).toBeNull();
    expect(formatScoreDateLabel(MOCK_ITEMS[1])).toBe('2026-08-23');
    expect(formatScoreDateLabel(MOCK_ITEMS[3])).toBeNull();
  });
});
