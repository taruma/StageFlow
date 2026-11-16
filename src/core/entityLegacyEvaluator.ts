/**
 * Tier 2: Legacy per-shot `shots[].entities` kinematics evaluator.
 * Evaluates character movements chained across individual film shots:
 *   - Baseline pose initialization from SceneEntityDef
 *   - Pass 1: Shot start/end positions and overrides
 *   - Pass 2: Shot start/end rotations (look-at target or walking direction auto-facing)
 *   - Runtime interpolation at elapsedSec with live facing angle resolution & floor trails
 * Pure Layer 1 module with zero React or DOM dependencies.
 */

import type {
  EvaluatedEntityState,
  SceneEntityDef,
  ShotCue,
  StageScore,
  Vec3,
} from './types';
import { evaluateCameraEasing } from './maneuvers';
import {
  cloneVec3,
  computeLookAtYawRad,
} from './sphericalMath';
import {
  type EntityLookAtPose,
  type EntityPoseSnapshot,
  buildGroundTrailPoints,
  getEntityBaseSize,
  lerpAngleShortest,
  relaxLookAtPoses,
  resolveCueStartEndPivot,
  resolveCueStartEndSize,
} from './entityKinematicUtils';

/**
 * Evaluates all scene entities chained across shots[].entities at elapsedSec.
 */
export function evaluateLegacyEntitiesAtTime(
  elapsedSec: number,
  score: StageScore
): {
  entitiesById: Map<string, EvaluatedEntityState>;
  entitiesList: EvaluatedEntityState[];
} {
  const sortedShots = [...score.shots].sort((a, b) => a.startSec - b.startSec);

  // Initialize baseline poses from SceneEntityDef
  const baselinePoses = new Map<string, EntityPoseSnapshot>();
  for (const def of score.entities) {
    baselinePoses.set(def.id, {
      position: cloneVec3(def.position),
      rotationYRad: def.rotationYRad,
      pitchRad: def.pitchRad ?? 0,
      rollRad: def.rollRad ?? 0,
      pivotRatio: def.pivotRatio ?? 0,
      visible: true,
      size: getEntityBaseSize(def),
    });
  }

  // Track start and end poses per shot for every entity
  const shotStartPoses = new Map<ShotCue, Map<string, EntityPoseSnapshot>>();
  const shotEndPoses = new Map<ShotCue, Map<string, EntityPoseSnapshot>>();

  let runningPoses = new Map<string, EntityPoseSnapshot>();
  for (const [id, pose] of baselinePoses.entries()) {
    runningPoses.set(id, {
      position: cloneVec3(pose.position),
      rotationYRad: pose.rotationYRad,
      pitchRad: pose.pitchRad,
      rollRad: pose.rollRad,
      pivotRatio: pose.pivotRatio,
      visible: pose.visible,
      size: cloneVec3(pose.size),
    });
  }

  for (const shot of sortedShots) {
    const startMap = new Map<string, EntityPoseSnapshot>();
    const endMap = new Map<string, EntityPoseSnapshot>();

    // First pass: determine start and end positions, sizes, and tilt for this shot
    const endPositions = new Map<string, Vec3>();
    const endSizes = new Map<string, Vec3>();
    const endPoses = new Map<string, EntityLookAtPose>();
    for (const def of score.entities) {
      const prev = runningPoses.get(def.id)!;
      const override = shot.entities[def.id];

      const isCut = Boolean(override?.cut);
      const startPos = isCut
        ? override?.position
          ? cloneVec3(override.position)
          : override?.fromPosition
          ? cloneVec3(override.fromPosition)
          : cloneVec3(prev.position)
        : override?.fromPosition
        ? cloneVec3(override.fromPosition)
        : cloneVec3(prev.position);
      const endPos = override?.position
        ? cloneVec3(override.position)
        : cloneVec3(startPos);

      const { startSize, endSize } = resolveCueStartEndSize(
        override ?? {},
        prev.size,
        isCut
      );

      const endPitch = override?.pitchRad ?? prev.pitchRad;
      const endRoll = override?.rollRad ?? prev.rollRad;
      const startPitch = isCut ? endPitch : prev.pitchRad;
      const startRoll = isCut ? endRoll : prev.rollRad;
      const { startPivot, endPivot } = resolveCueStartEndPivot(
        override?.pivotRatio,
        prev.pivotRatio,
        startPitch,
        startRoll,
        isCut
      );
      const baselineEndRot =
        override?.rotationYRad !== undefined
          ? override.rotationYRad
          : !override?.cut &&
            Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z) > 0.05
          ? computeLookAtYawRad(startPos, endPos)
          : prev.rotationYRad;

      startMap.set(def.id, {
        position: startPos,
        rotationYRad: prev.rotationYRad,
        pitchRad: startPitch,
        rollRad: startRoll,
        pivotRatio: startPivot,
        visible: override?.visible ?? prev.visible,
        size: startSize,
      });
      endPositions.set(def.id, endPos);
      endSizes.set(def.id, endSize);
      endPoses.set(def.id, {
        position: endPos,
        rotationYRad: baselineEndRot,
        pitchRad: endPitch,
        rollRad: endRoll,
        pivotRatio: endPivot,
        size: endSize,
      });
    }

    // Second pass: resolve end rotations (order-independent Jacobi relaxation) & pitch/roll
    const resolvedEndLookAts = relaxLookAtPoses(
      score.entities,
      endPositions,
      endPoses,
      (id) => {
        const ov = shot.entities[id];
        return ov?.rotationYRad === undefined ? ov?.lookAt : undefined;
      }
    );

    for (const def of score.entities) {
      const startSnap = startMap.get(def.id)!;
      const override = shot.entities[def.id];
      const endPos = endPositions.get(def.id)!;

      let endRot = endPoses.get(def.id)!.rotationYRad;
      if (
        override?.rotationYRad === undefined &&
        override?.lookAt &&
        !resolvedEndLookAts.has(def.id)
      ) {
        endRot = startSnap.rotationYRad;
      }

      const endSnap: EntityPoseSnapshot = {
        position: endPos,
        rotationYRad: endRot,
        pitchRad: override?.pitchRad ?? startSnap.pitchRad,
        rollRad: override?.rollRad ?? startSnap.rollRad,
        pivotRatio: endPoses.get(def.id)!.pivotRatio ?? startSnap.pivotRatio,
        visible: override?.visible ?? startSnap.visible,
        size: endSizes.get(def.id)!,
      };
      endMap.set(def.id, endSnap);
    }

    shotStartPoses.set(shot, startMap);
    shotEndPoses.set(shot, endMap);
    runningPoses = endMap;
  }

  // Find active shot or most recent finished shot at elapsedSec
  const activeShot = sortedShots
    .slice()
    .reverse()
    .find((s) => elapsedSec >= s.startSec && elapsedSec < s.endSec);

  const lastFinishedShot = sortedShots
    .slice()
    .reverse()
    .find((s) => elapsedSec >= s.endSec);

  const entitiesById = new Map<string, EvaluatedEntityState>();
  const entitiesList: EvaluatedEntityState[] = [];

  // First pass at current timestamp: interpolate positions
  const livePositions = new Map<string, Vec3>();
  const rawStates = new Map<
    string,
    {
      def: SceneEntityDef;
      startSnap: EntityPoseSnapshot;
      endSnap: EntityPoseSnapshot;
      u: number;
      highlighted: boolean;
      visible: boolean;
      note?: string;
    }
  >();

  for (const def of score.entities) {
    if (activeShot) {
      const startSnap =
        shotStartPoses.get(activeShot)?.get(def.id) ??
        baselinePoses.get(def.id)!;
      const endSnap =
        shotEndPoses.get(activeShot)?.get(def.id) ?? startSnap;
      const override = activeShot.entities[def.id];
      const shotDuration = Math.max(
        0.016,
        activeShot.endSec - activeShot.startSec
      );
      const tRaw = Math.min(
        1,
        Math.max(0, (elapsedSec - activeShot.startSec) / shotDuration)
      );
      const u = evaluateCameraEasing(override?.easing ?? 'smooth', tRaw);

      const pos: Vec3 = {
        x:
          startSnap.position.x +
          u * (endSnap.position.x - startSnap.position.x),
        y:
          startSnap.position.y +
          u * (endSnap.position.y - startSnap.position.y),
        z:
          startSnap.position.z +
          u * (endSnap.position.z - startSnap.position.z),
      };
      livePositions.set(def.id, pos);
      rawStates.set(def.id, {
        def,
        startSnap,
        endSnap,
        u,
        highlighted: Boolean(override?.highlighted),
        visible: override?.visible ?? startSnap.visible,
        note: override?.note,
      });
    } else if (lastFinishedShot) {
      const heldSnap =
        shotEndPoses.get(lastFinishedShot)?.get(def.id) ??
        baselinePoses.get(def.id)!;
      livePositions.set(def.id, cloneVec3(heldSnap.position));
      rawStates.set(def.id, {
        def,
        startSnap: heldSnap,
        endSnap: heldSnap,
        u: 1,
        highlighted: false,
        visible: heldSnap.visible,
      });
    } else {
      const baseSnap = baselinePoses.get(def.id)!;
      livePositions.set(def.id, cloneVec3(baseSnap.position));
      rawStates.set(def.id, {
        def,
        startSnap: baseSnap,
        endSnap: baseSnap,
        u: 0,
        highlighted: false,
        visible: baseSnap.visible,
      });
    }
  }

  // Pre-build live poses across all entities so lookAt sub-anchors see live yaw/pitch/roll/size
  const livePoses = new Map<string, EntityLookAtPose>();
  const preLookAtStates = new Map<
    string,
    {
      rotY: number;
      pitchRad: number;
      rollRad: number;
      pivotRatio: number;
      size: Vec3;
    }
  >();
  for (const def of score.entities) {
    const item = rawStates.get(def.id)!;
    const pos = livePositions.get(def.id)!;
    const rotY = lerpAngleShortest(
      item.startSnap.rotationYRad,
      item.endSnap.rotationYRad,
      item.u
    );
    const pitchRad = lerpAngleShortest(
      item.startSnap.pitchRad,
      item.endSnap.pitchRad,
      item.u
    );
    const rollRad = lerpAngleShortest(
      item.startSnap.rollRad,
      item.endSnap.rollRad,
      item.u
    );
    const pivotRatio =
      item.startSnap.pivotRatio +
      item.u * (item.endSnap.pivotRatio - item.startSnap.pivotRatio);
    const size: Vec3 = {
      x:
        item.startSnap.size.x +
        item.u * (item.endSnap.size.x - item.startSnap.size.x),
      y:
        item.startSnap.size.y +
        item.u * (item.endSnap.size.y - item.startSnap.size.y),
      z:
        item.startSnap.size.z +
        item.u * (item.endSnap.size.z - item.startSnap.size.z),
    };
    preLookAtStates.set(def.id, { rotY, pitchRad, rollRad, pivotRatio, size });
    livePoses.set(def.id, {
      position: pos,
      rotationYRad: rotY,
      pitchRad,
      rollRad,
      pivotRatio,
      size,
    });
  }

  // Second pass: resolve live facing angles (order-independent Jacobi lookAt relaxation) & floor trails
  relaxLookAtPoses(score.entities, livePositions, livePoses, (id) => {
    const ov = activeShot?.entities[id];
    return ov?.rotationYRad === undefined ? ov?.lookAt : undefined;
  });

  for (const def of score.entities) {
    const item = rawStates.get(def.id)!;
    const pos = livePositions.get(def.id)!;
    const override = activeShot?.entities[def.id];
    const pre = preLookAtStates.get(def.id)!;

    const rotY = livePoses.get(def.id)!.rotationYRad;
    const { pitchRad, rollRad, pivotRatio, size } = pre;

    const trailPoints = override?.cut
      ? []
      : buildGroundTrailPoints(
          item.startSnap.position,
          item.endSnap.position
        );

    const state: EvaluatedEntityState = {
      id: def.id,
      def,
      cueId: activeShot?.id ?? null,
      position: pos,
      rotationYRad: rotY,
      pitchRad,
      rollRad,
      pivotRatio,
      size,
      highlighted: item.highlighted,
      visible: item.visible,
      note: item.note,
      trailPoints,
    };

    entitiesById.set(def.id, state);
    entitiesList.push(state);
  }

  return { entitiesById, entitiesList };
}
