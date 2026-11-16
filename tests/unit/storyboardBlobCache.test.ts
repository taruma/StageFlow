import { describe, expect, it } from 'vitest';
import { parseStageScore } from '../../src/core/scoreParser';
import type { StageScore } from '../../src/core/types';
import {
  StoryboardBlobCache,
  type StoryboardCacheVariant,
} from '../../src/hooks/storyboardBlobCache';

const FIXTURE_YAML = `
version: "1.0"
id: cache-test-scene
title: Cache Test Scene
duration: 4
shots:
  - id: shot-1
    label: "Wide"
    start: 0
    end: 4
    stage_camera:
      maneuver: cut
      target: [0, 1, 0]
      distance: 5
      lens: 35
`;

function makeScoreClone(): StageScore {
  const { score } = parseStageScore(FIXTURE_YAML);
  if (!score) throw new Error('Expected valid StageScore fixture');
  return score;
}

function makeFakeBlobs(count: number): Blob[] {
  return Array.from(
    { length: count },
    (_, i) => new Blob([`panel-${i}`], { type: 'image/webp' })
  );
}

const STAGE_MID_LIGHT: StoryboardCacheVariant = {
  targetCamera: 'stage-cam',
  sampleMode: 'mid',
  themeCategory: 'light',
  dofBlurEnabled: false,
};

describe('StoryboardBlobCache', () => {
  it('caches and returns Blobs by StageScore identity and automatically misses on a new score instance', () => {
    const cache = new StoryboardBlobCache();
    const scoreA = makeScoreClone();
    const scoreB = makeScoreClone();
    const blobsA = makeFakeBlobs(3);

    expect(cache.get(scoreA, STAGE_MID_LIGHT)).toBeNull();
    expect(cache.set(scoreA, STAGE_MID_LIGHT, blobsA)).toBe(true);
    expect(cache.get(scoreA, STAGE_MID_LIGHT)).toBe(blobsA);
    expect(cache.get(scoreB, STAGE_MID_LIGHT)).toBeNull();
  });

  it('normalizes dofBlurEnabled for observer camera variants', () => {
    const cache = new StoryboardBlobCache();
    const score = makeScoreClone();
    const blobs = makeFakeBlobs(2);

    cache.set(score, { ...STAGE_MID_LIGHT, targetCamera: 'observer', dofBlurEnabled: true }, blobs);
    expect(
      cache.get(score, { ...STAGE_MID_LIGHT, targetCamera: 'observer', dofBlurEnabled: false })
    ).toBe(blobs);
    expect(cache.entryCount).toBe(1);
  });

  it('evicts the least-recently-used entry when maxEntries is exceeded', () => {
    const cache = new StoryboardBlobCache({ maxEntries: 2, maxTotalBlobs: 50 });
    const score = makeScoreClone();
    const v1: StoryboardCacheVariant = { ...STAGE_MID_LIGHT, sampleMode: 'start' };
    const v2: StoryboardCacheVariant = { ...STAGE_MID_LIGHT, sampleMode: 'mid' };
    const v3: StoryboardCacheVariant = { ...STAGE_MID_LIGHT, sampleMode: 'end' };

    cache.set(score, v1, makeFakeBlobs(2));
    cache.set(score, v2, makeFakeBlobs(2));
    // Touch v1 so v2 becomes the LRU entry
    expect(cache.get(score, v1)).not.toBeNull();

    cache.set(score, v3, makeFakeBlobs(2));

    expect(cache.entryCount).toBe(2);
    expect(cache.blobCount).toBe(4);
    expect(cache.get(score, v1)).not.toBeNull();
    expect(cache.get(score, v2)).toBeNull();
    expect(cache.get(score, v3)).not.toBeNull();
  });

  it('enforces the maxTotalBlobs cap and rejects empty or oversized panels', () => {
    const cache = new StoryboardBlobCache({ maxEntries: 10, maxTotalBlobs: 5 });
    const score = makeScoreClone();
    const v1: StoryboardCacheVariant = { ...STAGE_MID_LIGHT, themeCategory: 'light' };
    const v2: StoryboardCacheVariant = { ...STAGE_MID_LIGHT, themeCategory: 'dark' };

    expect(cache.set(score, v1, [])).toBe(false);
    expect(cache.set(score, v1, makeFakeBlobs(6))).toBe(false);
    expect(cache.blobCount).toBe(0);

    expect(cache.set(score, v1, makeFakeBlobs(3))).toBe(true);
    expect(cache.set(score, v2, makeFakeBlobs(3))).toBe(true);

    // v1 was evicted so total blobs stays <= 5
    expect(cache.blobCount).toBe(3);
    expect(cache.get(score, v1)).toBeNull();
    expect(cache.get(score, v2)).not.toBeNull();
  });

  it('supports targeted invalidation and full clear with accurate blob counts', () => {
    const cache = new StoryboardBlobCache();
    const score = makeScoreClone();
    const v2: StoryboardCacheVariant = { ...STAGE_MID_LIGHT, themeCategory: 'warm' };

    cache.set(score, STAGE_MID_LIGHT, makeFakeBlobs(4));
    cache.set(score, v2, makeFakeBlobs(3));
    expect(cache.blobCount).toBe(7);

    cache.invalidate(score, STAGE_MID_LIGHT);
    expect(cache.entryCount).toBe(1);
    expect(cache.blobCount).toBe(3);
    expect(cache.get(score, STAGE_MID_LIGHT)).toBeNull();

    cache.clear();
    expect(cache.entryCount).toBe(0);
    expect(cache.blobCount).toBe(0);
  });
});
