/**
 * Pure deterministic shot-sampling and grouping helpers for the StageFlow
 * Storyboard Generator. Zero React, DOM, or Three.js runtime dependencies.
 */

import type { ExportTargetCamera } from './exportMath';
import { computeStageFrame } from './frameEngine';
import type { ShotCue, StageFrame, StageScore, Vec3 } from './types';

export type StoryboardSampleMode =
  | 'mid'
  | 'start'
  | 'end'
  | 'start-end'
  | 'start-mid-end';
export type StoryboardBeatTag = 'START' | 'MID' | 'END' | null;
export type StoryboardGuideMode = 'off' | 'thirds' | 'safe' | 'all';

export interface StoryboardSamplePoint {
  key: string;
  shot: ShotCue;
  shotIndex: number;
  beatTag: StoryboardBeatTag;
  stageTimeSec: number;
  rawTimestampSec: number;
  frame: StageFrame;
}

export interface StoryboardShotGroup {
  key: string;
  shot: ShotCue;
  shotIndex: number;
  samples: StoryboardSamplePoint[];
  isMoving: boolean;
}

export interface StoryboardPanelMeta {
  shotNumber: number;
  label: string;
  timeRangeText: string;
  durationText: string;
  focalLengthText: string;
  maneuverText: string;
  rigText: string | null;
  apertureText: string | null;
  focusText: string | null;
  description: string;
}

export interface StoryboardCountChip {
  label: string;
  count: number;
}

export interface StoryboardSheetSummary {
  lenses: StoryboardCountChip[];
  maneuvers: StoryboardCountChip[];
  rigs: StoryboardCountChip[];
}

export {
  cleanShotLabel,
  formatStoryboardPanelMeta,
  formatStoryboardShotMeta,
  resolveStoryboardLayoutSpec,
  summarizeStoryboardSheet,
  type StoryboardDensity,
  type StoryboardGridColumns,
  type StoryboardLayoutSpec,
} from './storyboardLayout';

const MOTION_DELTA_EPSILON = 1e-3;
const END_SAMPLE_MAX_INSET_SEC = 1 / 60;

function vec3DiffExceeds(a: Vec3, b: Vec3, epsilon: number): boolean {
  return (
    Math.abs(a.x - b.x) > epsilon ||
    Math.abs(a.y - b.y) > epsilon ||
    Math.abs(a.z - b.z) > epsilon
  );
}

/**
 * Computes a boundary-safe stage timeline timestamp inside `[shot.startSec, shot.endSec)`
 * for `'start'`, `'mid'`, or `'end'`.
 */
export function computeShotSampleTimeSec(
  shot: ShotCue,
  anchor: 'start' | 'mid' | 'end',
  sceneDurationSec: number
): number {
  const safeSceneDuration = Math.max(0.1, sceneDurationSec);
  const clampedStart = Math.max(0, Math.min(safeSceneDuration, shot.startSec));
  const clampedEnd = Math.max(
    clampedStart,
    Math.min(safeSceneDuration, shot.endSec)
  );
  const shotDuration = Math.max(0, clampedEnd - clampedStart);

  if (anchor === 'start' || shotDuration === 0) {
    return clampedStart;
  }
  if (anchor === 'mid') {
    return clampedStart + shotDuration * 0.5;
  }
  const inset = Math.min(END_SAMPLE_MAX_INSET_SEC, shotDuration * 0.1);
  return Math.max(clampedStart, clampedEnd - inset);
}

/**
 * Determines whether a shot exhibits camera or entity motion across its window.
 */
export function isMovingShotForStoryboard(
  startFrame: StageFrame,
  endFrame: StageFrame,
  targetCamera: ExportTargetCamera
): boolean {
  const startTrack =
    targetCamera === 'observer'
      ? startFrame.observerCamera
      : startFrame.stageCamera;
  const endTrack =
    targetCamera === 'observer'
      ? endFrame.observerCamera
      : endFrame.stageCamera;

  if (startTrack.maneuver !== 'cut' || endTrack.maneuver !== 'cut') {
    return true;
  }

  if (
    vec3DiffExceeds(
      startTrack.transform.position,
      endTrack.transform.position,
      MOTION_DELTA_EPSILON
    ) ||
    vec3DiffExceeds(
      startTrack.transform.target,
      endTrack.transform.target,
      MOTION_DELTA_EPSILON
    ) ||
    Math.abs(startTrack.transform.fovDeg - endTrack.transform.fovDeg) > 0.05 ||
    Math.abs(startTrack.transform.pose.roll - endTrack.transform.pose.roll) >
      MOTION_DELTA_EPSILON
  ) {
    return true;
  }

  if (startFrame.entitiesList.length !== endFrame.entitiesList.length) {
    return true;
  }

  for (let i = 0; i < startFrame.entitiesList.length; i++) {
    const a = startFrame.entitiesList[i];
    const b = endFrame.entitiesById.get(a.id);
    if (!b) return true;
    if (
      a.visible !== b.visible ||
      vec3DiffExceeds(a.position, b.position, MOTION_DELTA_EPSILON) ||
      Math.abs(a.rotationYRad - b.rotationYRad) > MOTION_DELTA_EPSILON ||
      Math.abs((a.pitchRad ?? 0) - (b.pitchRad ?? 0)) > MOTION_DELTA_EPSILON ||
      Math.abs((a.rollRad ?? 0) - (b.rollRad ?? 0)) > MOTION_DELTA_EPSILON
    ) {
      return true;
    }
  }

  return false;
}

function makeSamplePoint(
  shot: ShotCue,
  shotIndex: number,
  beatTag: StoryboardBeatTag,
  stageTimeSec: number,
  score: StageScore,
  precomputedFrame?: StageFrame
): StoryboardSamplePoint {
  const rawTimestampSec = stageTimeSec - score.offsetSec;
  const frame = precomputedFrame ?? computeStageFrame(rawTimestampSec, score);
  const keySuffix = beatTag ? beatTag.toLowerCase() : 'single';
  return {
    key: `${shot.id}-${shotIndex}-${keySuffix}`,
    shot,
    shotIndex,
    beatTag,
    stageTimeSec,
    rawTimestampSec,
    frame,
  };
}

/**
 * Generates deterministic storyboard sample points across `score.shots`.
 */
export function buildStoryboardSamples(
  score: StageScore,
  mode: StoryboardSampleMode,
  targetCamera: ExportTargetCamera = 'stage-cam'
): StoryboardSamplePoint[] {
  if (!score?.shots || score.shots.length === 0) {
    return [];
  }

  const samples: StoryboardSamplePoint[] = [];

  for (let i = 0; i < score.shots.length; i++) {
    const shot = score.shots[i];
    if (mode === 'start-end' || mode === 'start-mid-end') {
      const startSec = computeShotSampleTimeSec(shot, 'start', score.durationSec);
      const endSec = computeShotSampleTimeSec(shot, 'end', score.durationSec);
      const startFrame = computeStageFrame(startSec - score.offsetSec, score);
      const endFrame = computeStageFrame(endSec - score.offsetSec, score);

      if (isMovingShotForStoryboard(startFrame, endFrame, targetCamera)) {
        samples.push(makeSamplePoint(shot, i, 'START', startSec, score, startFrame));
        if (mode === 'start-mid-end') {
          const midSec = computeShotSampleTimeSec(shot, 'mid', score.durationSec);
          samples.push(makeSamplePoint(shot, i, 'MID', midSec, score));
        }
        samples.push(makeSamplePoint(shot, i, 'END', endSec, score, endFrame));
      } else {
        const midSec = computeShotSampleTimeSec(shot, 'mid', score.durationSec);
        samples.push(makeSamplePoint(shot, i, null, midSec, score));
      }
      continue;
    }

    const stageTimeSec = computeShotSampleTimeSec(shot, mode, score.durationSec);
    samples.push(makeSamplePoint(shot, i, null, stageTimeSec, score));
  }

  return samples;
}

/**
 * Groups flat sample points back into per-shot cards (1, 2, or 3 frames per card).
 */
export function groupStoryboardSamplesByShot(
  samples: StoryboardSamplePoint[]
): StoryboardShotGroup[] {
  const groups: StoryboardShotGroup[] = [];
  const byShotIndex = new Map<number, StoryboardShotGroup>();

  for (const sample of samples) {
    let group = byShotIndex.get(sample.shotIndex);
    if (!group) {
      group = {
        key: `${sample.shot.id}-${sample.shotIndex}`,
        shot: sample.shot,
        shotIndex: sample.shotIndex,
        samples: [],
        isMoving: false,
      };
      byShotIndex.set(sample.shotIndex, group);
      groups.push(group);
    }
    group.samples.push(sample);
    if (group.samples.length > 1) {
      group.isMoving = true;
    }
  }

  return groups;
}
