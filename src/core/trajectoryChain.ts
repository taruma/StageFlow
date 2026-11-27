/**
 * Unified forward-chaining trajectory evaluator used by both the Observer Camera
 * and the illustrative Stage Camera.
 * Pure Layer 1 module with zero React or DOM dependencies.
 */

import type {
  CameraCueSpec,
  EvaluatedCameraRigState,
  EvaluatedCameraTrack,
  EvaluatedEntityState,
  SphericalPose,
  StageScore,
  Vec3,
} from './types';
import { evaluateCameraEasing } from './maneuvers';
import {
  clampSphericalPose,
  cloneSphericalPose,
  sphericalToCartesian,
} from './sphericalMath';
import {
  ZERO_OFFSET,
  resolveShotDestOffset,
  resolveShotDestRoll,
  resolveShotStartOffset,
  resolveShotStartRoll,
  resolveTargetPoint3D,
} from './cameraTargetResolver';
import {
  evaluateShotCameraPose,
  evaluateSplineCameraPose,
  sampleTrajectoryPoints,
} from './shotPoseEvaluator';
import { sampleRigRailPoints } from './cameraRigEvaluator';
import { evaluateEntitiesAtTime } from './entityEngine';

// Re-export target resolution and shot-boundary reset helpers for backward compatibility
export {
  ZERO_OFFSET,
  resolveShotDestOffset,
  resolveShotDestRoll,
  resolveShotStartOffset,
  resolveShotStartRoll,
  resolveTargetPoint3D,
};

// Re-export single-shot pose evaluators and sampling helpers for backward compatibility
export {
  evaluateShotCameraPose,
  evaluateSplineCameraPose,
  sampleTrajectoryPoints,
};

export type TrackRole = 'observer' | 'stage';

interface NormalizedCameraCue {
  id: string;
  startSec: number;
  endSec: number;
  continuous?: boolean;
  spec: CameraCueSpec;
}

function extractTrackCues(
  role: TrackRole,
  score: StageScore
): NormalizedCameraCue[] {
  if (role === 'observer' && score.observerShots !== undefined) {
    return score.observerShots
      .map((os) => ({
        id: os.id,
        startSec: os.startSec,
        endSec: os.endSec,
        continuous: os.continuous ?? os.camera.continuous,
        spec: os.camera,
      }))
      .sort((a, b) => a.startSec - b.startSec);
  }

  const cues: NormalizedCameraCue[] = [];
  for (const s of score.shots) {
    const spec = role === 'observer' ? s.observerCamera : s.stageCamera;
    if (spec !== undefined) {
      cues.push({
        id: s.id,
        startSec: s.startSec,
        endSec: s.endSec,
        continuous: spec.continuous ?? s.continuous,
        spec,
      });
    }
  }
  return cues.sort((a, b) => a.startSec - b.startSec);
}

interface CueTrackCache {
  cues: NormalizedCameraCue[];
  cueStartOffsets: Map<string, Vec3>;
  cueEndOffsets: Map<string, Vec3>;
  cueBaseStartPoses: Map<string, SphericalPose>;
  cueEndPoses: Map<string, SphericalPose>;
  cuePrevEndEyes: Map<string, Vec3>;
  cuePrevEndPoses: Map<string, SphericalPose>;
  cuePrevEndOffsets: Map<string, Vec3>;
  cueIndices: Map<string, number>;
  cueTrajectoryPoints: Map<string, Vec3[]>;
  cueRailPoints: Map<string, Vec3[]>;
}

const trackCache = new WeakMap<StageScore, Map<string, CueTrackCache>>();

function resolveCueStartPose(
  spec: CameraCueSpec,
  prevEndPose: SphericalPose,
  baselinePose: SphericalPose,
  prevEndOffset: Vec3,
  startOffset: Vec3,
  entitiesById: Map<string, EvaluatedEntityState>,
  isContinuous: boolean
): SphericalPose {
  const prevBaseTarget: Vec3 = {
    x: prevEndPose.target.x - prevEndOffset.x,
    y: prevEndPose.target.y - prevEndOffset.y,
    z: prevEndPose.target.z - prevEndOffset.z,
  };
  const target = spec.from
    ? resolveTargetPoint3D(spec.from, entitiesById, prevBaseTarget, startOffset)
    : spec.target
    ? resolveTargetPoint3D(spec.target, entitiesById, prevBaseTarget, startOffset)
    : {
        x: prevBaseTarget.x + startOffset.x,
        y: prevBaseTarget.y + startOffset.y,
        z: prevBaseTarget.z + startOffset.z,
      };
  return clampSphericalPose({
    target,
    distance:
      spec.distanceStart ??
      (isContinuous
        ? prevEndPose.distance
        : spec.distance ?? prevEndPose.distance),
    pitch:
      spec.pitchStartRad ??
      (isContinuous ? prevEndPose.pitch : spec.pitchRad ?? prevEndPose.pitch),
    yaw:
      spec.yawStartRad ??
      (isContinuous || spec.yawDeltaRad !== undefined
        ? prevEndPose.yaw
        : spec.yawRad ?? prevEndPose.yaw),
    roll: resolveShotStartRoll(spec, prevEndPose, baselinePose, isContinuous),
    focalLengthMm:
      spec.focalLengthStartMm ?? spec.focalLengthMm ?? prevEndPose.focalLengthMm,
  });
}

function sampleCueTrajectoryPoints(
  cue: NormalizedCameraCue,
  score: StageScore,
  prevEndPose: SphericalPose,
  baselinePose: SphericalPose,
  prevEndOffset: Vec3,
  isFirst: boolean,
  samples = 32
): Vec3[] {
  const spec = cue.spec;
  if (spec.maneuver === 'cut' || spec.rig?.type === 'tripod') {
    return [];
  }

  const isContinuousMove =
    Boolean(cue.continuous ?? score.continuous) &&
    !isFirst;
  const prevEndEye = isContinuousMove
    ? sphericalToCartesian(prevEndPose).position
    : undefined;

  const durationSec = Math.max(0.016, cue.endSec - cue.startSec);
  const startOffset = resolveShotStartOffset(spec, prevEndOffset, isContinuousMove);
  const endOffset = resolveShotDestOffset(spec, prevEndOffset, isContinuousMove);

  const points: Vec3[] = [];
  for (let i = 0; i <= samples; i++) {
    const frac = i / samples;
    const t = cue.startSec + frac * durationSec;
    const { entitiesById } = evaluateEntitiesAtTime(t, score);
    const P_start = resolveCueStartPose(
      spec,
      prevEndPose,
      baselinePose,
      prevEndOffset,
      startOffset,
      entitiesById,
      isContinuousMove
    );

    const pose = evaluateShotCameraPose(
      P_start,
      spec,
      frac,
      durationSec,
      entitiesById,
      baselinePose,
      startOffset,
      endOffset,
      isContinuousMove,
      prevEndEye
    );
    const cart = sphericalToCartesian(pose, score.aspectRatio);
    points.push(cart.position);
  }

  return points;
}

function getOrCreateCueTrackCache(
  role: TrackRole,
  score: StageScore,
  baselinePose: SphericalPose,
  initialPoseOverride?: SphericalPose
): CueTrackCache {
  let scoreMap = trackCache.get(score);
  if (!scoreMap) {
    scoreMap = new Map();
    trackCache.set(score, scoreMap);
  }

  const cacheKey = `${role}:${
    initialPoseOverride
      ? `${initialPoseOverride.yaw.toFixed(4)}_${initialPoseOverride.pitch.toFixed(4)}_${initialPoseOverride.distance.toFixed(4)}`
      : 'default'
  }`;

  const cached = scoreMap.get(cacheKey);
  if (cached) {
    return cached;
  }

  const cues = extractTrackCues(role, score);
  const cueStartOffsets = new Map<string, Vec3>();
  const cueEndOffsets = new Map<string, Vec3>();
  const cueBaseStartPoses = new Map<string, SphericalPose>();
  const cueEndPoses = new Map<string, SphericalPose>();
  const cuePrevEndEyes = new Map<string, Vec3>();
  const cuePrevEndPoses = new Map<string, SphericalPose>();
  const cuePrevEndOffsets = new Map<string, Vec3>();
  const cueIndices = new Map<string, number>();
  const cueTrajectoryPoints = new Map<string, Vec3[]>();
  const cueRailPoints = new Map<string, Vec3[]>();

  let runningPose = baselinePose;
  let runningOffset = ZERO_OFFSET;

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const isContinuous =
      Boolean(cue.continuous ?? score.continuous) &&
      i > 0 &&
      cue.spec.maneuver !== 'cut';
    const prevEndEye = sphericalToCartesian(runningPose).position;
    cuePrevEndEyes.set(cue.id, prevEndEye);
    cuePrevEndPoses.set(cue.id, runningPose);
    cuePrevEndOffsets.set(cue.id, runningOffset);
    cueIndices.set(cue.id, i);

    // Advance runningPose and runningOffset for contiguous chaining
    const prevEndOffset = runningOffset;
    const startOffset = resolveShotStartOffset(cue.spec, prevEndOffset, isContinuous);
    const endOffset = resolveShotDestOffset(cue.spec, prevEndOffset, isContinuous);
    cueStartOffsets.set(cue.id, startOffset);
    cueEndOffsets.set(cue.id, endOffset);
    runningOffset = endOffset;

    const { entitiesById: endEntities } = evaluateEntitiesAtTime(cue.endSec, score);
    const pStart = resolveCueStartPose(
      cue.spec,
      runningPose,
      baselinePose,
      prevEndOffset,
      startOffset,
      endEntities,
      isContinuous
    );

    cueBaseStartPoses.set(cue.id, pStart);

    const dur = Math.max(0.016, cue.endSec - cue.startSec);
    runningPose = evaluateShotCameraPose(
      pStart,
      cue.spec,
      1.0,
      dur,
      endEntities,
      baselinePose,
      startOffset,
      endOffset,
      isContinuous,
      isContinuous ? prevEndEye : undefined
    );
    cueEndPoses.set(cue.id, runningPose);
  }

  const data: CueTrackCache = {
    cues,
    cueStartOffsets,
    cueEndOffsets,
    cueBaseStartPoses,
    cueEndPoses,
    cuePrevEndEyes,
    cuePrevEndPoses,
    cuePrevEndOffsets,
    cueIndices,
    cueTrajectoryPoints,
    cueRailPoints,
  };

  scoreMap.set(cacheKey, data);
  return data;
}

function getOrSampleCueTrajectoryPoints(
  cache: CueTrackCache,
  cue: NormalizedCameraCue,
  score: StageScore,
  baselinePose: SphericalPose
): Vec3[] {
  const cached = cache.cueTrajectoryPoints.get(cue.id);
  if (cached) return cached;

  const prevEndPose = cache.cuePrevEndPoses.get(cue.id) ?? baselinePose;
  const prevEndOffset = cache.cuePrevEndOffsets.get(cue.id) ?? ZERO_OFFSET;
  const cueIndex = cache.cueIndices.get(cue.id) ?? 0;

  const points = sampleCueTrajectoryPoints(
    cue,
    score,
    prevEndPose,
    baselinePose,
    prevEndOffset,
    cueIndex === 0
  );
  cache.cueTrajectoryPoints.set(cue.id, points);
  return points;
}

function getOrSampleCueRailPoints(
  cache: CueTrackCache,
  cue: NormalizedCameraCue,
  score: StageScore,
  baselinePose: SphericalPose
): Vec3[] {
  const cached = cache.cueRailPoints.get(cue.id);
  if (cached) return cached;

  if (!cue.spec.rig) {
    cache.cueRailPoints.set(cue.id, []);
    return [];
  }

  const cueIndex = cache.cueIndices.get(cue.id) ?? 0;
  const isContinuous =
    Boolean(cue.continuous ?? score.continuous) &&
    cueIndex > 0 &&
    cue.spec.maneuver !== 'cut';
  const prevEndEye =
    cache.cuePrevEndEyes.get(cue.id) ??
    sphericalToCartesian(baselinePose).position;

  let railFallbackEye = prevEndEye;
  if (!isContinuous) {
    const prevEndPose = cache.cuePrevEndPoses.get(cue.id) ?? baselinePose;
    const prevEndOffset = cache.cuePrevEndOffsets.get(cue.id) ?? ZERO_OFFSET;
    const startOffset = cache.cueStartOffsets.get(cue.id) ?? ZERO_OFFSET;
    const { entitiesById: startEntities } = evaluateEntitiesAtTime(cue.startSec, score);
    const startPoseAtCueStart = resolveCueStartPose(
      cue.spec,
      prevEndPose,
      baselinePose,
      prevEndOffset,
      startOffset,
      startEntities,
      false
    );
    railFallbackEye = sphericalToCartesian(startPoseAtCueStart).position;
  }

  const points = sampleRigRailPoints(cue.spec.rig, railFallbackEye);
  cache.cueRailPoints.set(cue.id, points);
  return points;
}

/**
 * Evaluates the complete deterministic camera trajectory chain for either 'observer' or 'stage'.
 */
export function evaluateCameraTrack(
  role: TrackRole,
  elapsedSec: number,
  score: StageScore,
  entitiesById: Map<string, EvaluatedEntityState>,
  initialPoseOverride?: SphericalPose
): EvaluatedCameraTrack {
  const defaultPose =
    role === 'observer'
      ? initialPoseOverride ?? score.stage.defaultObserverPose
      : score.stage.defaultStageCameraPose;

  const baselinePose = cloneSphericalPose(defaultPose);

  const trackCacheData = getOrCreateCueTrackCache(
    role,
    score,
    baselinePose,
    initialPoseOverride
  );
  const cues = trackCacheData.cues;

  if (cues.length === 0) {
    return {
      active: false,
      isHold: true,
      shotId: null,
      maneuver: 'cut',
      transform: sphericalToCartesian(baselinePose, score.aspectRatio),
      trajectoryPoints: [],
      baseTarget: { ...baselinePose.target },
      targetOffset: ZERO_OFFSET,
    };
  }

  // 1. Check if a cue is currently active at elapsedSec (latest matching cue takes priority)
  let activeCue: NormalizedCameraCue | undefined;
  for (let i = cues.length - 1; i >= 0; i--) {
    const c = cues[i];
    if (elapsedSec >= c.startSec && elapsedSec < c.endSec) {
      activeCue = c;
      break;
    }
  }

  if (activeCue) {
    const spec = activeCue.spec;
    const basePose =
      trackCacheData.cueBaseStartPoses.get(activeCue.id) ?? baselinePose;
    const startOffset =
      trackCacheData.cueStartOffsets.get(activeCue.id) ?? ZERO_OFFSET;
    const durationSec = Math.max(0.016, activeCue.endSec - activeCue.startSec);
    const tRaw = Math.min(
      1,
      Math.max(0, (elapsedSec - activeCue.startSec) / durationSec)
    );

    const unshiftedBaseTarget: Vec3 = {
      x: basePose.target.x - startOffset.x,
      y: basePose.target.y - startOffset.y,
      z: basePose.target.z - startOffset.z,
    };

    const startTarget = spec.from
      ? resolveTargetPoint3D(
          spec.from,
          entitiesById,
          unshiftedBaseTarget,
          startOffset
        )
      : spec.target
      ? resolveTargetPoint3D(
          spec.target,
          entitiesById,
          unshiftedBaseTarget,
          startOffset
        )
      : { ...basePose.target };

    const startPose = clampSphericalPose({
      ...basePose,
      target: startTarget,
    });

    const endOffset =
      trackCacheData.cueEndOffsets.get(activeCue.id) ?? resolveShotDestOffset(spec);
    const activeCueIdx = cues.findIndex((c) => c.id === activeCue.id);
    const isContinuous =
      Boolean(activeCue.continuous ?? score.continuous) &&
      activeCueIdx > 0 &&
      activeCue.spec.maneuver !== 'cut';
    const prevEndEye = isContinuous
      ? trackCacheData.cuePrevEndEyes.get(activeCue.id)
      : undefined;

    const livePose = evaluateShotCameraPose(
      startPose,
      spec,
      tRaw,
      durationSec,
      entitiesById,
      baselinePose,
      startOffset,
      endOffset,
      isContinuous,
      prevEndEye
    );
    const trajectoryPoints = getOrSampleCueTrajectoryPoints(
      trackCacheData,
      activeCue,
      score,
      baselinePose
    );

    const u = evaluateCameraEasing(spec.easing, tRaw);
    const liveOffset: Vec3 = {
      x: startOffset.x + (endOffset.x - startOffset.x) * u,
      y: startOffset.y + (endOffset.y - startOffset.y) * u,
      z: startOffset.z + (endOffset.z - startOffset.z) * u,
    };
    const baseTarget: Vec3 = {
      x: livePose.target.x - liveOffset.x,
      y: livePose.target.y - liveOffset.y,
      z: livePose.target.z - liveOffset.z,
    };

    const transform = sphericalToCartesian(livePose, score.aspectRatio);
    const rigState: EvaluatedCameraRigState | undefined = spec.rig
      ? {
          type: spec.rig.type,
          progress: u,
          eyePosition: transform.position,
          railPoints: getOrSampleCueRailPoints(
            trackCacheData,
            activeCue,
            score,
            baselinePose
          ),
          hasTargetLock:
            spec.target !== undefined || spec.from !== undefined,
        }
      : undefined;

    return {
      active: true,
      isHold: false,
      shotId: activeCue.id,
      maneuver: spec.maneuver,
      transform,
      trajectoryPoints,
      baseTarget,
      targetOffset: liveOffset,
      ...(rigState ? { rig: rigState } : {}),
    };
  }

  // 2. Before first cue starts
  if (elapsedSec < cues[0].startSec) {
    const firstBase =
      trackCacheData.cueBaseStartPoses.get(cues[0].id) ?? baselinePose;
    const firstOffset =
      trackCacheData.cueStartOffsets.get(cues[0].id) ?? ZERO_OFFSET;
    return {
      active: false,
      isHold: true,
      shotId: null,
      maneuver: 'cut',
      transform: sphericalToCartesian(firstBase, score.aspectRatio),
      trajectoryPoints: [],
      baseTarget: {
        x: firstBase.target.x - firstOffset.x,
        y: firstBase.target.y - firstOffset.y,
        z: firstBase.target.z - firstOffset.z,
      },
      targetOffset: firstOffset,
    };
  }

  // 3. In a gap between cues or at/after the end of the timeline
  let lastFinished: NormalizedCameraCue | undefined;
  for (let i = cues.length - 1; i >= 0; i--) {
    if (elapsedSec >= cues[i].endSec) {
      lastFinished = cues[i];
      break;
    }
  }

  const heldPose =
    (lastFinished
      ? trackCacheData.cueEndPoses.get(lastFinished.id)
      : undefined) ?? baselinePose;
  const heldSpec = lastFinished?.spec;
  const heldEndOffset = lastFinished
    ? trackCacheData.cueEndOffsets.get(lastFinished.id) ?? ZERO_OFFSET
    : ZERO_OFFSET;
  const heldTrajectoryPoints = lastFinished
    ? getOrSampleCueTrajectoryPoints(
        trackCacheData,
        lastFinished,
        score,
        baselinePose
      )
    : [];
  const heldTransform = sphericalToCartesian(heldPose, score.aspectRatio);
  const heldRigState: EvaluatedCameraRigState | undefined = heldSpec?.rig
    ? {
        type: heldSpec.rig.type,
        progress: 1,
        eyePosition: heldTransform.position,
        railPoints: lastFinished
          ? getOrSampleCueRailPoints(
              trackCacheData,
              lastFinished,
              score,
              baselinePose
            )
          : [],
        hasTargetLock:
          heldSpec.target !== undefined || heldSpec.from !== undefined,
      }
    : undefined;

  return {
    active: false,
    isHold: true,
    shotId: lastFinished?.id ?? null,
    maneuver: heldSpec?.maneuver ?? 'cut',
    transform: heldTransform,
    trajectoryPoints: heldTrajectoryPoints,
    baseTarget: {
      x: heldPose.target.x - heldEndOffset.x,
      y: heldPose.target.y - heldEndOffset.y,
      z: heldPose.target.z - heldEndOffset.z,
    },
    targetOffset: heldEndOffset,
    ...(heldRigState ? { rig: heldRigState } : {}),
  };
}
