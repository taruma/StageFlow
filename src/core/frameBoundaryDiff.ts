/**
 * Pure Layer 1 Boundary State Diff Detector.
 * Determines whether shot IDs, entity cue IDs, visibility, highlight states,
 * or trail path references changed between two evaluated StageFrames so React UI
 * state only re-commits at actual structural boundaries during headless/offscreen renders.
 */

import type { StageFrame, Vec3 } from './types';

export function areTrailPointsEqual(a: Vec3[], b: Vec3[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y || a[i].z !== b[i].z) {
      return false;
    }
  }
  return true;
}

export function hasStageFrameBoundaryChanged(
  prev: StageFrame,
  next: StageFrame
): boolean {
  if (prev.stageCamera.shotId !== next.stageCamera.shotId) {
    return true;
  }
  if (prev.observerCamera.shotId !== next.observerCamera.shotId) {
    return true;
  }
  if (prev.entitiesList.length !== next.entitiesList.length) {
    return true;
  }
  for (let i = 0; i < next.entitiesList.length; i++) {
    const a = prev.entitiesList[i];
    const b = next.entitiesList[i];
    if (
      a.id !== b.id ||
      a.cueId !== b.cueId ||
      a.highlighted !== b.highlighted ||
      a.visible !== b.visible ||
      !areTrailPointsEqual(a.trailPoints, b.trailPoints)
    ) {
      return true;
    }
  }
  return false;
}
