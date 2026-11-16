/**
 * Tier 1: Decoupled root `blocking:` timeline kinematics evaluator.
 * Evaluates continuous multi-cut kinematics across blocking cues:
 *   - Two-pass continuous multi-cut evaluation (positions and facing rotations)
 *   - Option A full-cue floor trails across camera cuts
 *   - Continuous C0 look_at handoff and mutual gaze resolution
 *   - Pose hold persistence across gap intervals
 *   - Hybrid per-shot highlight and note overlays
 * Pure Layer 1 module with zero React or DOM dependencies.
 */

import type {
  EvaluatedEntityState,
  StageScore,
  Vec3,
} from './types';
import { evaluateCameraEasing } from './maneuvers';
import {
  cloneVec3,
  computeLookAtYawRad,
  shortestAngleDiff,
} from './sphericalMath';
import {
  type ChainedBlockingCueEntry,
  type EntityLookAtPose,
  buildGroundTrailPoints,
  getEntityBaseSize,
  lerpAngleShortest,
  relaxLookAtPoses,
  resolveCueStartEndPivot,
  resolveCueStartEndSize,
  resolveLookAtPoint,
} from './entityKinematicUtils';

/**
 * Evaluates entities against the decoupled root `blocking:` timeline at elapsedSec.
 */
export function evaluateBlockingEntitiesAtTime(
  elapsedSec: number,
  score: StageScore
): {
  entitiesById: Map<string, EvaluatedEntityState>;
  entitiesList: EvaluatedEntityState[];
} {
  const blockingCues = score.blocking ?? [];
  const chainsByEntity = new Map<string, ChainedBlockingCueEntry[]>();

  // Pass 1: Build forward-chained 3D world position, size, tilt, and baseline rotation tracks per entity
  for (const def of score.entities) {
    const entityCues = blockingCues
      .filter((c) => c.entityId.toLowerCase() === def.id.toLowerCase())
      .sort((a, b) => a.startSec - b.startSec);

    let prevPos: Vec3 = cloneVec3(def.position);
    let prevSize: Vec3 = getEntityBaseSize(def);
    let prevRot = def.rotationYRad;
    let prevPitch = def.pitchRad ?? 0;
    let prevRoll = def.rollRad ?? 0;
    let prevPivot = def.pivotRatio ?? 0;
    let prevVis: boolean = true;
    const entries: ChainedBlockingCueEntry[] = [];

    for (const cue of entityCues) {
      const isCut = Boolean(cue.cut);
      const startPos = isCut
        ? cue.position
          ? cloneVec3(cue.position)
          : cue.fromPosition
          ? cloneVec3(cue.fromPosition)
          : cloneVec3(prevPos)
        : cue.fromPosition
        ? cloneVec3(cue.fromPosition)
        : cloneVec3(prevPos);
      const endPos = cue.position
        ? cloneVec3(cue.position)
        : cloneVec3(startPos);
      const { startSize, endSize } = resolveCueStartEndSize(
        cue,
        prevSize,
        isCut
      );
      const visible: boolean = cue.visible ?? prevVis;

      const endPitch = cue.pitchRad ?? prevPitch;
      const endRoll = cue.rollRad ?? prevRoll;
      const startPitch = isCut ? endPitch : prevPitch;
      const startRoll = isCut ? endRoll : prevRoll;
      const { startPivot, endPivot } = resolveCueStartEndPivot(
        cue.pivotRatio,
        prevPivot,
        startPitch,
        startRoll,
        isCut
      );

      let endRot = prevRot;
      if (cue.rotationYRad !== undefined) {
        endRot = cue.rotationYRad;
      } else if (
        !isCut &&
        Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z) > 0.05
      ) {
        endRot = computeLookAtYawRad(startPos, endPos);
      }

      entries.push({
        cue,
        startPos,
        endPos,
        startRot: prevRot,
        endRot,
        startPitch,
        endPitch,
        startRoll,
        endRoll,
        startPivot,
        endPivot,
        startSize,
        endSize,
        visible,
        isCut,
      });

      prevPos = cloneVec3(endPos);
      prevSize = cloneVec3(endSize);
      prevRot = endRot;
      prevPitch = endPitch;
      prevRoll = endRoll;
      prevPivot = endPivot;
      prevVis = visible;
    }

    chainsByEntity.set(def.id, entries);
  }

  // Helper to evaluate all entity positions & pose snapshots at any arbitrary timestamp t
  const evaluateSnapshotAt = (t: number) => {
    const posMap = new Map<string, Vec3>();
    const poseMap = new Map<string, EntityLookAtPose>();
    const activeMap = new Map<string, ChainedBlockingCueEntry>();
    const lastFinishedMap = new Map<string, ChainedBlockingCueEntry>();

    for (const def of score.entities) {
      const chain = chainsByEntity.get(def.id) ?? [];
      const active = chain
        .slice()
        .reverse()
        .find((e) => t >= e.cue.startSec && t < e.cue.endSec);
      const lastFinished = chain
        .slice()
        .reverse()
        .find((e) => t >= e.cue.endSec);

      if (active) {
        const dur = Math.max(0.016, active.cue.endSec - active.cue.startSec);
        const tau = Math.min(1, Math.max(0, (t - active.cue.startSec) / dur));
        const u = evaluateCameraEasing(active.cue.easing, tau);
        const position: Vec3 = {
          x: active.startPos.x + u * (active.endPos.x - active.startPos.x),
          y: active.startPos.y + u * (active.endPos.y - active.startPos.y),
          z: active.startPos.z + u * (active.endPos.z - active.startPos.z),
        };
        const size: Vec3 = {
          x: active.startSize.x + u * (active.endSize.x - active.startSize.x),
          y: active.startSize.y + u * (active.endSize.y - active.startSize.y),
          z: active.startSize.z + u * (active.endSize.z - active.startSize.z),
        };
        posMap.set(def.id, position);
        poseMap.set(def.id, {
          position,
          rotationYRad: lerpAngleShortest(active.startRot, active.endRot, u),
          pitchRad: lerpAngleShortest(active.startPitch, active.endPitch, u),
          rollRad: lerpAngleShortest(active.startRoll, active.endRoll, u),
          pivotRatio:
            active.startPivot + u * (active.endPivot - active.startPivot),
          size,
        });
        activeMap.set(def.id, active);
      } else if (lastFinished) {
        const position = cloneVec3(lastFinished.endPos);
        posMap.set(def.id, position);
        poseMap.set(def.id, {
          position,
          rotationYRad: lastFinished.endRot,
          pitchRad: lastFinished.endPitch,
          rollRad: lastFinished.endRoll,
          pivotRatio: lastFinished.endPivot,
          size: cloneVec3(lastFinished.endSize),
        });
        lastFinishedMap.set(def.id, lastFinished);
      } else {
        const position = cloneVec3(def.position);
        posMap.set(def.id, position);
        poseMap.set(def.id, {
          position,
          rotationYRad: def.rotationYRad,
          pitchRad: def.pitchRad ?? 0,
          rollRad: def.rollRad ?? 0,
          pivotRatio: def.pivotRatio ?? 0,
          size: getEntityBaseSize(def),
        });
      }
    }
    return { posMap, poseMap, activeMap, lastFinishedMap };
  };

  // Pass 2: Build forward-chained facing rotations (order-independent Jacobi relaxation)
  const MAX_LOOK_AT_ITERS = 8;
  for (let iter = 0; iter < MAX_LOOK_AT_ITERS; iter++) {
    const nextChains = new Map<
      string,
      Array<{ entry: ChainedBlockingCueEntry; startRot: number; endRot: number }>
    >();
    let maxDeltaYaw = 0;

    for (const def of score.entities) {
      const chain = chainsByEntity.get(def.id) ?? [];
      let prevRot = def.rotationYRad;
      const updates: Array<{
        entry: ChainedBlockingCueEntry;
        startRot: number;
        endRot: number;
      }> = [];

      for (const entry of chain) {
        const startRot = prevRot;
        let endRot = startRot;

        if (entry.cue.rotationYRad !== undefined) {
          endRot = entry.cue.rotationYRad;
        } else if (entry.cue.lookAt) {
          const sampleTime = Math.max(entry.cue.startSec, entry.cue.endSec - 1e-6);
          const snapAtEnd = evaluateSnapshotAt(sampleTime);
          const targetPt = resolveLookAtPoint(
            entry.cue.lookAt,
            snapAtEnd.posMap,
            score.entities,
            snapAtEnd.poseMap
          );
          if (targetPt) {
            endRot = computeLookAtYawRad(entry.endPos, targetPt);
          }
        } else if (
          !entry.isCut &&
          Math.hypot(
            entry.endPos.x - entry.startPos.x,
            entry.endPos.z - entry.startPos.z
          ) > 0.05
        ) {
          endRot = computeLookAtYawRad(entry.startPos, entry.endPos);
        }

        const startDelta = Math.abs(shortestAngleDiff(startRot, entry.startRot));
        const endDelta = Math.abs(shortestAngleDiff(endRot, entry.endRot));
        if (startDelta > maxDeltaYaw) maxDeltaYaw = startDelta;
        if (endDelta > maxDeltaYaw) maxDeltaYaw = endDelta;

        updates.push({ entry, startRot, endRot });
        prevRot = endRot;
      }

      nextChains.set(def.id, updates);
    }

    for (const updates of nextChains.values()) {
      for (const { entry, startRot, endRot } of updates) {
        entry.startRot = startRot;
        entry.endRot = endRot;
      }
    }

    if (maxDeltaYaw < 1e-7) {
      break;
    }
  }

  // Resolve active film shot for hybrid per-shot focus metadata (highlighted / note)
  const sortedShots = [...score.shots].sort((a, b) => a.startSec - b.startSec);
  const activeShot = sortedShots
    .slice()
    .reverse()
    .find((s) => elapsedSec >= s.startSec && elapsedSec < s.endSec);

  const liveSnapshot = evaluateSnapshotAt(elapsedSec);
  relaxLookAtPoses(
    score.entities,
    liveSnapshot.posMap,
    liveSnapshot.poseMap,
    (id) => {
      const active = liveSnapshot.activeMap.get(id);
      return active && active.cue.rotationYRad === undefined
        ? active.cue.lookAt
        : undefined;
    }
  );

  const entitiesById = new Map<string, EvaluatedEntityState>();
  const entitiesList: EvaluatedEntityState[] = [];

  for (const def of score.entities) {
    const pos = liveSnapshot.posMap.get(def.id)!;
    const pose = liveSnapshot.poseMap.get(def.id)!;
    const active = liveSnapshot.activeMap.get(def.id);
    const lastFinished = liveSnapshot.lastFinishedMap.get(def.id);
    const shotOv = activeShot?.entities[def.id];

    const rotY = pose.rotationYRad;
    const pitchRad = pose.pitchRad ?? 0;
    const rollRad = pose.rollRad ?? 0;
    const pivotRatio = pose.pivotRatio ?? def.pivotRatio ?? 0;
    const size: Vec3 = pose.size ?? getEntityBaseSize(def);
    let visible = shotOv?.visible ?? true;
    let highlighted = Boolean(shotOv?.highlighted);
    let note = shotOv?.note;
    let trailPoints: Vec3[] = [];
    let cueId: string | null = 'preroll';

    if (active) {
      visible = active.visible;
      highlighted = Boolean(active.cue.highlighted ?? shotOv?.highlighted);
      note = active.cue.note ?? shotOv?.note;
      trailPoints = active.cue.cut
        ? []
        : buildGroundTrailPoints(active.startPos, active.endPos);
      cueId = active.cue.id;
    } else if (lastFinished) {
      visible = lastFinished.visible;
      cueId = `hold:${lastFinished.cue.id}`;
    }

    const state: EvaluatedEntityState = {
      id: def.id,
      def,
      cueId,
      position: pos,
      rotationYRad: rotY,
      pitchRad,
      rollRad,
      pivotRatio,
      size,
      highlighted,
      visible,
      note,
      trailPoints,
    };

    entitiesById.set(def.id, state);
    entitiesList.push(state);
  }

  return { entitiesById, entitiesList };
}
