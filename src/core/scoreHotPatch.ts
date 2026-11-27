/**
 * Pure shallow-clone numeric hot-patcher for 60fps Figma-style scrub previews.
 * Mutates only the targeted numeric field on a shallowly cloned `StageScore` without
 * re-parsing YAML or regenerating untouched `StageScore` objects.
 * Returns `null` for non-hot-patchable paths so callers can fall back to AST commit.
 * Pure Layer 1 module: zero React, DOM, or Three.js dependencies.
 */

import type {
  CameraCueSpec,
  ShotTimingEditMode,
  SphericalPose,
  StageScore,
  Vec3,
} from './types';
import type { YamlPath } from './schema/scoreSchemaTypes';
import {
  clampApertureFStop,
  clampFocalLengthMm,
} from './opticsMath';
import { clampSphericalPose, degToRad } from './sphericalMath';
import { parseMetricDistanceM } from './scorePrimitives';

function toVec3(val: unknown): Vec3 | null {
  if (!Array.isArray(val) || val.length < 3) return null;
  const x = Number(val[0]);
  const y = Number(val[1]);
  const z = Number(val[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return { x, y, z };
}

function patchSphericalPose(
  pose: SphericalPose,
  key: string,
  val: unknown
): SphericalPose | null {
  if (key === 'distance' && typeof val === 'number' && Number.isFinite(val)) {
    return clampSphericalPose({ ...pose, distance: val });
  }
  if (key === 'pitch' && typeof val === 'number' && Number.isFinite(val)) {
    return clampSphericalPose({ ...pose, pitch: degToRad(val) });
  }
  if (key === 'yaw' && typeof val === 'number' && Number.isFinite(val)) {
    return clampSphericalPose({ ...pose, yaw: degToRad(val) });
  }
  if (
    (key === 'roll' || key === 'dutch' || key === 'tilt_roll') &&
    typeof val === 'number' &&
    Number.isFinite(val)
  ) {
    return clampSphericalPose({ ...pose, roll: degToRad(val) });
  }
  if (
    (key === 'lens' || key === 'focal_length' || key === 'focalLengthMm') &&
    typeof val === 'number' &&
    Number.isFinite(val)
  ) {
    return clampSphericalPose({
      ...pose,
      focalLengthMm: clampFocalLengthMm(val),
    });
  }
  if (key === 'target') {
    const v = toVec3(val);
    if (v) return clampSphericalPose({ ...pose, target: v });
  }
  return null;
}

function patchCameraCueSpec<T extends CameraCueSpec>(
  spec: T,
  key: string,
  val: unknown
): T | null {
  const num = typeof val === 'number' && Number.isFinite(val) ? val : null;

  if (key === 'distance' && num !== null) return { ...spec, distance: num };
  if (key === 'distance_start' && num !== null) return { ...spec, distanceStart: num };
  if (key === 'distance_end' && num !== null) return { ...spec, distanceEnd: num };
  if (key === 'pitch' && num !== null) return { ...spec, pitchRad: degToRad(num) };
  if ((key === 'pitch_start' || key === 'pitchStart') && num !== null) {
    return { ...spec, pitchStartRad: degToRad(num) };
  }
  if ((key === 'pitch_end' || key === 'pitchEnd') && num !== null) {
    return { ...spec, pitchEndRad: degToRad(num) };
  }
  if (key === 'yaw' && num !== null) return { ...spec, yawRad: degToRad(num) };
  if ((key === 'yaw_delta' || key === 'yawDelta') && num !== null) {
    return { ...spec, yawDeltaRad: degToRad(num) };
  }
  if ((key === 'yaw_start' || key === 'yawStart') && num !== null) {
    return { ...spec, yawStartRad: degToRad(num) };
  }
  if ((key === 'yaw_end' || key === 'yawEnd') && num !== null) {
    return { ...spec, yawEndRad: degToRad(num) };
  }
  if ((key === 'roll' || key === 'dutch') && num !== null) {
    return { ...spec, rollRad: degToRad(num) };
  }
  if ((key === 'roll_delta' || key === 'rollDelta') && num !== null) {
    return { ...spec, rollDeltaRad: degToRad(num) };
  }
  if ((key === 'roll_start' || key === 'rollStart') && num !== null) {
    return { ...spec, rollStartRad: degToRad(num) };
  }
  if ((key === 'roll_end' || key === 'rollEnd') && num !== null) {
    return { ...spec, rollEndRad: degToRad(num) };
  }
  if ((key === 'lens' || key === 'focal_length' || key === 'focalLengthMm') && num !== null) {
    return { ...spec, focalLengthMm: clampFocalLengthMm(num) };
  }
  if (key === 'lens_start' && num !== null) {
    return { ...spec, focalLengthStartMm: clampFocalLengthMm(num) };
  }
  if (key === 'lens_end' && num !== null) {
    return { ...spec, focalLengthEndMm: clampFocalLengthMm(num) };
  }
  if ((key === 'focus_distance' || key === 'focusDistance' || key === 'focus_dist') && num !== null) {
    return { ...spec, focusDistanceM: parseMetricDistanceM(num) };
  }
  if ((key === 'focus_distance_start' || key === 'focusDistanceStart') && num !== null) {
    return { ...spec, focusDistanceStartM: parseMetricDistanceM(num) };
  }
  if ((key === 'focus_distance_end' || key === 'focusDistanceEnd') && num !== null) {
    return { ...spec, focusDistanceEndM: parseMetricDistanceM(num) };
  }
  if ((key === 'aperture' || key === 'f_stop' || key === 'fStop' || key === 't_stop') && num !== null) {
    return { ...spec, apertureFStop: clampApertureFStop(num) };
  }
  if ((key === 'aperture_start' || key === 'apertureStart' || key === 'f_stop_start') && num !== null) {
    return { ...spec, apertureStartFStop: clampApertureFStop(num) };
  }
  if ((key === 'aperture_end' || key === 'apertureEnd' || key === 'f_stop_end') && num !== null) {
    return { ...spec, apertureEndFStop: clampApertureFStop(num) };
  }
  if (key === 'breathe' && num !== null) return { ...spec, breathe: num };
  if (key === 'revolutions' && num !== null) return { ...spec, revolutions: num };
  if ((key === 'orbit_speed' || key === 'orbitSpeed') && num !== null) {
    return { ...spec, orbitSpeedRad: degToRad(num) };
  }
  if (key === 'target') {
    const v = toVec3(val);
    if (v) return { ...spec, target: v };
  }
  if (key === 'from') {
    const v = toVec3(val);
    if (v) return { ...spec, from: v };
  }
  if (key === 'target_offset' || key === 'targetOffset') {
    const v = toVec3(val);
    if (v) return { ...spec, targetOffset: v };
  }
  if (key === 'target_offset_start' || key === 'targetOffsetStart') {
    const v = toVec3(val);
    if (v) return { ...spec, targetOffsetStart: v };
  }
  if (key === 'target_offset_end' || key === 'targetOffsetEnd') {
    const v = toVec3(val);
    if (v) return { ...spec, targetOffsetEnd: v };
  }
  return null;
}

/**
 * Applies an ephemeral numeric hot-patch to a `StageScore` during Figma-style drag scrubbing.
 * Returns `null` when the path requires full YAML AST re-parsing.
 */
export function applyScoreHotPatch(
  score: StageScore,
  path: YamlPath,
  rawHumanValue: unknown
): StageScore | null {
  if (path.length === 1 && path[0] === 'duration' && typeof rawHumanValue === 'number') {
    return { ...score, durationSec: Math.max(0.1, rawHumanValue) };
  }
  if (path.length === 1 && path[0] === 'offset' && typeof rawHumanValue === 'number') {
    return { ...score, offsetSec: rawHumanValue };
  }

  // stage.*
  if (path[0] === 'stage') {
    if (path.length === 2 && typeof rawHumanValue === 'number') {
      if (path[1] === 'width') {
        return { ...score, stage: { ...score.stage, width: Math.max(1, rawHumanValue) } };
      }
      if (path[1] === 'depth') {
        return { ...score, stage: { ...score.stage, depth: Math.max(1, rawHumanValue) } };
      }
      if (path[1] === 'grid_step' || path[1] === 'gridStep') {
        return { ...score, stage: { ...score.stage, gridStep: Math.max(0.25, rawHumanValue) } };
      }
    }
    if (path.length === 3 && (path[1] === 'observer_camera' || path[1] === 'observerCamera')) {
      const nextPose = patchSphericalPose(
        score.stage.defaultObserverPose,
        String(path[2]),
        rawHumanValue
      );
      if (!nextPose) return null;
      return { ...score, stage: { ...score.stage, defaultObserverPose: nextPose } };
    }
    if (path.length === 3 && (path[1] === 'stage_camera' || path[1] === 'stageCamera')) {
      const nextPose = patchSphericalPose(
        score.stage.defaultStageCameraPose,
        String(path[2]),
        rawHumanValue
      );
      if (!nextPose) return null;
      return { ...score, stage: { ...score.stage, defaultStageCameraPose: nextPose } };
    }
  }

  // entities[i].*
  if (path[0] === 'entities' && typeof path[1] === 'number' && path.length === 3) {
    const idx = path[1];
    const ent = score.entities[idx];
    if (!ent) return null;
    const key = String(path[2]);
    let nextEnt = { ...ent };
    if (key === 'position') {
      const v = toVec3(rawHumanValue);
      if (!v) return null;
      nextEnt.position = v;
    } else if ((key === 'rotation' || key === 'yaw') && typeof rawHumanValue === 'number') {
      nextEnt.rotationYRad = degToRad(rawHumanValue);
    } else if (key === 'pitch' && typeof rawHumanValue === 'number') {
      nextEnt.pitchRad = degToRad(rawHumanValue);
    } else if (key === 'roll' && typeof rawHumanValue === 'number') {
      nextEnt.rollRad = degToRad(rawHumanValue);
    } else if (key === 'size' || key === 'dimensions') {
      const v = toVec3(rawHumanValue);
      if (!v || v.x <= 0 || v.y <= 0 || v.z <= 0) return null;
      nextEnt.width = v.x;
      nextEnt.height = v.y;
      nextEnt.depth = v.z;
      nextEnt.radius = Math.max(v.x, v.z) * 0.5;
    } else if (key === 'width' && typeof rawHumanValue === 'number' && rawHumanValue > 0) {
      nextEnt.width = rawHumanValue;
    } else if (key === 'height' && typeof rawHumanValue === 'number' && rawHumanValue > 0) {
      nextEnt.height = rawHumanValue;
    } else if ((key === 'depth' || key === 'length') && typeof rawHumanValue === 'number' && rawHumanValue > 0) {
      nextEnt.depth = rawHumanValue;
    } else if (key === 'radius' && typeof rawHumanValue === 'number' && rawHumanValue > 0) {
      nextEnt.radius = rawHumanValue;
      nextEnt.width = rawHumanValue * 2;
      nextEnt.depth = rawHumanValue * 2;
    } else {
      return null;
    }
    const nextEntities = [...score.entities];
    nextEntities[idx] = nextEnt;
    return { ...score, entities: nextEntities };
  }

  // shots[i].*
  if ((path[0] === 'shots' || path[0] === 'score') && typeof path[1] === 'number') {
    const idx = path[1];
    const shot = score.shots[idx];
    if (!shot) return null;

    if (path.length === 3) {
      const key = String(path[2]);
      if (key === 'start' && typeof rawHumanValue === 'number') {
        const nextShot = { ...shot, startSec: Math.max(0, Math.min(shot.endSec - 0.1, rawHumanValue)) };
        const nextShots = [...score.shots];
        nextShots[idx] = nextShot;
        return { ...score, shots: nextShots };
      }
      if (key === 'end' && typeof rawHumanValue === 'number') {
        const nextShot = { ...shot, endSec: Math.max(shot.startSec + 0.1, rawHumanValue) };
        const nextShots = [...score.shots];
        nextShots[idx] = nextShot;
        return { ...score, shots: nextShots };
      }
      if (shot.stageCamera) {
        const nextCam = patchCameraCueSpec(shot.stageCamera, key, rawHumanValue);
        if (nextCam) {
          const nextShots = [...score.shots];
          nextShots[idx] = { ...shot, stageCamera: nextCam };
          return { ...score, shots: nextShots };
        }
      }
      return null;
    }

    if (path.length === 4) {
      const container = String(path[2]);
      const key = String(path[3]);
      if ((container === 'stage_camera' || container === 'stageCamera' || container === 'camera') && shot.stageCamera) {
        const nextCam = patchCameraCueSpec(shot.stageCamera, key, rawHumanValue);
        if (!nextCam) return null;
        const nextShots = [...score.shots];
        nextShots[idx] = { ...shot, stageCamera: nextCam };
        return { ...score, shots: nextShots };
      }
      if ((container === 'observer_camera' || container === 'observerCamera') && shot.observerCamera) {
        const nextObs = patchCameraCueSpec(shot.observerCamera, key, rawHumanValue);
        if (!nextObs) return null;
        const nextShots = [...score.shots];
        nextShots[idx] = { ...shot, observerCamera: nextObs };
        return { ...score, shots: nextShots };
      }
    }

    if (path.length === 5 && path[3] === 'rig' && shot.stageCamera?.rig) {
      const rig = shot.stageCamera.rig;
      const rigKey = String(path[4]);
      const v = toVec3(rawHumanValue);
      if (!v) return null;
      const nextRig =
        rigKey === 'position' || rigKey === 'pos'
          ? { ...rig, position: v }
          : rigKey === 'from' || rigKey === 'start'
          ? { ...rig, from: v }
          : rigKey === 'to' || rigKey === 'end'
          ? { ...rig, to: v }
          : null;
      if (!nextRig) return null;
      const nextShots = [...score.shots];
      nextShots[idx] = {
        ...shot,
        stageCamera: { ...shot.stageCamera, rig: nextRig },
      };
      return { ...score, shots: nextShots };
    }
  }

  // observer_shots[i].*
  if ((path[0] === 'observer_shots' || path[0] === 'observerShots') && typeof path[1] === 'number' && score.observerShots) {
    const idx = path[1];
    const os = score.observerShots[idx];
    if (!os) return null;
    const key = path.length === 3 ? String(path[2]) : path.length === 4 ? String(path[3]) : null;
    if (!key) return null;
    const nextCam = patchCameraCueSpec(os.camera, key, rawHumanValue);
    if (!nextCam) return null;
    const nextOs = [...score.observerShots];
    nextOs[idx] = { ...os, camera: nextCam };
    return { ...score, observerShots: nextOs };
  }

  return null;
}

function roundSec(val: number): number {
  return Math.round(val * 1000) / 1000;
}

/**
 * Applies an ephemeral shot timing adjustment (`'free' | 'roll' | 'ripple'`) on a shallowly cloned `StageScore`
 * for 60fps timestamp Figma-pill scrubbing without YAML AST parsing.
 */
export function applyShotTimingHotPatch(
  score: StageScore,
  shotIndex: number,
  edge: 'start' | 'end',
  nextValueSec: number,
  mode: ShotTimingEditMode
): StageScore | null {
  if (
    shotIndex < 0 ||
    shotIndex >= score.shots.length ||
    !Number.isFinite(nextValueSec)
  ) {
    return null;
  }

  const curr = score.shots[shotIndex];
  const minDur = 0.1;

  if (mode === 'free') {
    const clamped =
      edge === 'start'
        ? Math.max(0, Math.min(curr.endSec - minDur, nextValueSec))
        : Math.max(curr.startSec + minDur, nextValueSec);
    const rounded = roundSec(clamped);
    const nextShots = [...score.shots];
    nextShots[shotIndex] =
      edge === 'start'
        ? { ...curr, startSec: rounded }
        : { ...curr, endSec: rounded };
    return { ...score, shots: nextShots };
  }

  if (mode === 'roll') {
    const nextShots = [...score.shots];
    if (edge === 'end') {
      const nextShot =
        shotIndex + 1 < score.shots.length ? score.shots[shotIndex + 1] : null;
      const maxEnd = nextShot ? nextShot.endSec - minDur : Infinity;
      const clamped = roundSec(
        Math.max(curr.startSec + minDur, Math.min(maxEnd, nextValueSec))
      );
      nextShots[shotIndex] = { ...curr, endSec: clamped };
      if (nextShot) {
        nextShots[shotIndex + 1] = { ...nextShot, startSec: clamped };
      }
    } else {
      const prevShot = shotIndex - 1 >= 0 ? score.shots[shotIndex - 1] : null;
      const minStart = prevShot ? prevShot.startSec + minDur : 0;
      const clamped = roundSec(
        Math.max(minStart, Math.min(curr.endSec - minDur, nextValueSec))
      );
      nextShots[shotIndex] = { ...curr, startSec: clamped };
      if (prevShot) {
        nextShots[shotIndex - 1] = { ...prevShot, endSec: clamped };
      }
    }
    return { ...score, shots: nextShots };
  }

  // 'ripple': shift downstream shots & update scene duration
  const prevEdgeVal = edge === 'start' ? curr.startSec : curr.endSec;
  const clamped = roundSec(
    edge === 'start'
      ? Math.max(0, Math.min(curr.endSec - minDur, nextValueSec))
      : Math.max(curr.startSec + minDur, nextValueSec)
  );
  const delta = clamped - prevEdgeVal;

  const nextShots = [...score.shots];
  nextShots[shotIndex] =
    edge === 'start'
      ? { ...curr, startSec: clamped }
      : { ...curr, endSec: clamped };

  if (Math.abs(delta) < 1e-6) {
    return { ...score, shots: nextShots };
  }

  for (let i = shotIndex + 1; i < nextShots.length; i++) {
    const item = nextShots[i];
    nextShots[i] = {
      ...item,
      startSec: roundSec(Math.max(0, item.startSec + delta)),
      endSec: roundSec(Math.max(0.1, item.endSec + delta)),
    };
  }

  return {
    ...score,
    durationSec: roundSec(Math.max(0.1, score.durationSec + delta)),
    shots: nextShots,
  };
}
