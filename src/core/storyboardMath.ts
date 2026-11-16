/**
 * Pure deterministic shot-sampling, grouping, and summary metadata helpers for
 * the StageFlow Storyboard Generator. Zero React, DOM, or Three.js runtime dependencies.
 */

import type { ExportTargetCamera } from './exportMath';
import { computeStageFrame } from './frameEngine';
import { formatApertureFStop } from './opticsMath';
import type { ShotCue, StageFrame, StageScore, Vec3 } from './types';

export type StoryboardSampleMode =
  | 'mid'
  | 'start'
  | 'end'
  | 'start-end'
  | 'start-mid-end';
export type StoryboardColumns = 2 | 3 | 4;
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

const MOTION_DELTA_EPSILON = 1e-3;
const END_SAMPLE_MAX_INSET_SEC = 1 / 60;

/**
 * Strips redundant "Shot ## · ", "Shot ##: ", or "Shot ## - " prefixes from user labels
 * since panel badges already display the shot number.
 */
export function cleanShotLabel(rawLabel: string): string {
  if (!rawLabel || typeof rawLabel !== 'string') return '';
  return rawLabel.replace(/^Shot\s*\d+\s*[·:–-]\s*/i, '').trim() || rawLabel;
}

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

function formatRangeValue(
  first: string,
  last: string
): string {
  return first === last ? first : `${first} → ${last}`;
}

function formatRigName(type: string): string {
  return type === 'spline_track' ? 'spline' : type;
}

/**
 * Extracts formatted directorial & DP optics/rig metadata for a shot card.
 */
export function formatStoryboardShotMeta(
  samples: StoryboardSamplePoint[],
  targetCamera: ExportTargetCamera
): StoryboardPanelMeta {
  const first = samples[0];
  const last = samples[samples.length - 1];
  const { shot } = first;

  const firstTrack =
    targetCamera === 'observer'
      ? first.frame.observerCamera
      : first.frame.stageCamera;
  const lastTrack =
    targetCamera === 'observer'
      ? last.frame.observerCamera
      : last.frame.stageCamera;

  const durationSec = Math.max(0, shot.endSec - shot.startSec);
  const firstLens = `${Math.round(firstTrack.transform.pose.focalLengthMm)}mm`;
  const lastLens = `${Math.round(lastTrack.transform.pose.focalLengthMm)}mm`;

  let apertureText: string | null = null;
  let focusText: string | null = null;

  if (targetCamera === 'stage-cam') {
    const firstDof = first.frame.stageCamera.dof;
    const lastDof = last.frame.stageCamera.dof;
    if (firstDof.enabled || lastDof.enabled) {
      const a1 = firstDof.enabled
        ? formatApertureFStop(firstDof.apertureFStop)
        : 'Deep';
      const a2 = lastDof.enabled
        ? formatApertureFStop(lastDof.apertureFStop)
        : 'Deep';
      apertureText = formatRangeValue(a1, a2);
    }
    if (
      firstDof.hasExplicitFocus ||
      lastDof.hasExplicitFocus ||
      firstDof.enabled ||
      lastDof.enabled
    ) {
      const f1 = `${firstDof.focusDistanceM.toFixed(1)}m`;
      const f2 = `${lastDof.focusDistanceM.toFixed(1)}m`;
      focusText = `F ${formatRangeValue(f1, f2)}`;
    }
  }

  const rigRaw = firstTrack.rig?.type ?? lastTrack.rig?.type ?? null;

  return {
    shotNumber: shot.shotNumber,
    label: cleanShotLabel(shot.label) || shot.id,
    timeRangeText: `${shot.startSec.toFixed(1)}s–${shot.endSec.toFixed(1)}s`,
    durationText: `${durationSec.toFixed(1)}s`,
    focalLengthText: formatRangeValue(firstLens, lastLens),
    maneuverText: firstTrack.maneuver,
    rigText: rigRaw ? formatRigName(rigRaw) : null,
    apertureText,
    focusText,
    description: (shot.description ?? '').trim(),
  };
}

/**
 * Backward-compatible single-sample metadata formatter wrapper.
 */
export function formatStoryboardPanelMeta(
  sample: StoryboardSamplePoint,
  targetCamera: ExportTargetCamera
): StoryboardPanelMeta {
  return formatStoryboardShotMeta([sample], targetCamera);
}

/**
 * Aggregates unique focal lengths, camera maneuvers, and physical rigs across
 * all grouped shots for the Contact Sheet header summary strip.
 */
export function summarizeStoryboardSheet(
  groups: StoryboardShotGroup[],
  targetCamera: ExportTargetCamera
): StoryboardSheetSummary {
  const lensCounts = new Map<number, number>();
  const maneuverCounts = new Map<string, number>();
  const rigCounts = new Map<string, number>();

  for (const group of groups) {
    const rep = group.samples[0];
    if (!rep) continue;
    const track =
      targetCamera === 'observer'
        ? rep.frame.observerCamera
        : rep.frame.stageCamera;

    const mm = Math.round(track.transform.pose.focalLengthMm);
    lensCounts.set(mm, (lensCounts.get(mm) ?? 0) + 1);

    maneuverCounts.set(
      track.maneuver,
      (maneuverCounts.get(track.maneuver) ?? 0) + 1
    );

    if (track.rig?.type) {
      const rigName = formatRigName(track.rig.type);
      rigCounts.set(rigName, (rigCounts.get(rigName) ?? 0) + 1);
    }
  }

  return {
    lenses: Array.from(lensCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([mm, count]) => ({ label: `${mm}mm`, count })),
    maneuvers: Array.from(maneuverCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count })),
    rigs: Array.from(rigCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, count })),
  };
}
