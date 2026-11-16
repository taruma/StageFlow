/**
 * Bounded In-Memory LRU Cache for Storyboard Preview Blobs.
 * Stores compressed WebP/JPEG Blobs (never blob: object URLs) keyed by
 * WeakMap-tracked StageScore identity and render variant so reopening the
 * Storyboard modal or toggling views restores instantly without memory leaks.
 */

import type { ExportTargetCamera } from '../core/exportMath';
import type { StoryboardSampleMode } from '../core/storyboardMath';
import type { AppThemeCategory, StageScore } from '../core/types';

export interface StoryboardCacheVariant {
  targetCamera: ExportTargetCamera;
  sampleMode: StoryboardSampleMode;
  themeCategory: AppThemeCategory;
  dofBlurEnabled: boolean;
}

export interface StoryboardBlobCacheOptions {
  maxEntries?: number;
  maxTotalBlobs?: number;
}

const DEFAULT_MAX_ENTRIES = 4;
const DEFAULT_MAX_TOTAL_BLOBS = 150;

export class StoryboardBlobCache {
  private readonly maxEntries: number;
  private readonly maxTotalBlobs: number;
  private readonly scoreIds = new WeakMap<StageScore, number>();
  private readonly entries = new Map<string, Blob[]>();
  private nextScoreId = 1;
  private totalBlobs = 0;

  constructor(options: StoryboardBlobCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.maxTotalBlobs = Math.max(
      1,
      options.maxTotalBlobs ?? DEFAULT_MAX_TOTAL_BLOBS
    );
  }

  get entryCount(): number {
    return this.entries.size;
  }

  get blobCount(): number {
    return this.totalBlobs;
  }

  private getOrAssignScoreId(score: StageScore): number {
    let id = this.scoreIds.get(score);
    if (id === undefined) {
      id = this.nextScoreId++;
      this.scoreIds.set(score, id);
    }
    return id;
  }

  private buildKey(scoreId: number, variant: StoryboardCacheVariant): string {
    // Observer mode renders without DoF bokeh, so normalize DoF to avoid duplicate entries
    const effectiveDof =
      variant.targetCamera === 'stage-cam' && variant.dofBlurEnabled ? 1 : 0;
    return `${scoreId}|${variant.targetCamera}|${variant.sampleMode}|${variant.themeCategory}|${effectiveDof}`;
  }

  get(score: StageScore, variant: StoryboardCacheVariant): Blob[] | null {
    const scoreId = this.scoreIds.get(score);
    if (scoreId === undefined) {
      return null;
    }
    const key = this.buildKey(scoreId, variant);
    const hit = this.entries.get(key);
    if (!hit) {
      return null;
    }
    // Promote to most-recently-used position
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit;
  }

  set(
    score: StageScore,
    variant: StoryboardCacheVariant,
    blobs: Blob[]
  ): boolean {
    if (blobs.length === 0 || blobs.length > this.maxTotalBlobs) {
      return false;
    }

    const scoreId = this.getOrAssignScoreId(score);
    const key = this.buildKey(scoreId, variant);

    const existing = this.entries.get(key);
    if (existing) {
      this.totalBlobs -= existing.length;
      this.entries.delete(key);
    }

    while (
      this.entries.size >= this.maxEntries ||
      this.totalBlobs + blobs.length > this.maxTotalBlobs
    ) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      const oldestBlobs = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      if (oldestBlobs) {
        this.totalBlobs -= oldestBlobs.length;
      }
    }

    this.entries.set(key, blobs);
    this.totalBlobs += blobs.length;
    return true;
  }

  invalidate(score: StageScore, variant: StoryboardCacheVariant): void {
    const scoreId = this.scoreIds.get(score);
    if (scoreId === undefined) return;
    const key = this.buildKey(scoreId, variant);
    const existing = this.entries.get(key);
    if (existing) {
      this.totalBlobs -= existing.length;
      this.entries.delete(key);
    }
  }

  clear(): void {
    this.entries.clear();
    this.totalBlobs = 0;
  }
}
