/**
 * Pure Layer 1 2D Top-Down Minimap Geometry & Bounds Math.
 * Zero React, DOM, or Three.js runtime dependencies.
 * Coordinate convention: SVG X = world X, SVG Y = world Z (-Z Upstage at top, +Z Downstage at bottom).
 */

import { computeStageFrame } from './frameEngine';
import { sphericalToCartesian } from './sphericalMath';
import type { SphericalPose, StageScore, Vec3 } from './types';

export interface MinimapBounds {
  minX: number;
  minZ: number;
  span: number;
  viewBox: string;
  gridStepM: number;
  unitScale: number;
}

export interface MinimapCameraGeometry {
  camX: number;
  camZ: number;
  targetX: number;
  targetZ: number;
  conePath: string;
  focusBar: {
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    fx: number;
    fz: number;
  };
}

export interface MinimapObserverGeometry {
  obsX: number;
  obsZ: number;
  targetX: number;
  targetZ: number;
  dirEndX: number;
  dirEndZ: number;
  isClamped: boolean;
}

/**
 * Samples entities and shot keyframes across a StageScore to compute a static,
 * non-jittering top-down SVG viewBox covering the entire active stage.
 */
export function computeDioramaMinimapBounds(score: StageScore): MinimapBounds {
  let minX = 0;
  let maxX = 0;
  let minZ = 0;
  let maxZ = 0;

  const expandPoint = (x: number, z: number, pad = 0) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (x - pad < minX) minX = x - pad;
    if (x + pad > maxX) maxX = x + pad;
    if (z - pad < minZ) minZ = z - pad;
    if (z + pad > maxZ) maxZ = z + pad;
  };

  for (const ent of score.entities ?? []) {
    const halfSpan = Math.max(ent.width ?? ent.radius * 2, ent.depth ?? ent.radius * 2) * 0.5;
    expandPoint(ent.position.x, ent.position.z, halfSpan);
  }

  const sampleTimes = new Set<number>([0]);
  for (const shot of score.shots ?? []) {
    sampleTimes.add(shot.startSec);
    sampleTimes.add((shot.startSec + shot.endSec) * 0.5);
    sampleTimes.add(Math.max(shot.startSec, shot.endSec - 1e-3));
  }

  for (const t of sampleTimes) {
    const frame = computeStageFrame(t, score);
    for (const ent of frame.entitiesList) {
      if (!ent.visible) continue;
      const w = ent.size?.x ?? ent.def.width ?? ent.def.radius * 2;
      const d = ent.size?.z ?? ent.def.depth ?? ent.def.radius * 2;
      const halfSpan = Math.max(w, d) * 0.5;
      expandPoint(ent.position.x, ent.position.z, halfSpan);
    }
    expandPoint(
      frame.stageCamera.transform.position.x,
      frame.stageCamera.transform.position.z
    );
    expandPoint(
      frame.stageCamera.transform.target.x,
      frame.stageCamera.transform.target.z
    );
  }

  const rawSpanX = maxX - minX;
  const rawSpanZ = maxZ - minZ;
  const span = Number(Math.max(12, Math.max(rawSpanX, rawSpanZ) * 1.28).toFixed(2));
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const boxMinX = Number((centerX - span * 0.5).toFixed(2));
  const boxMinZ = Number((centerZ - span * 0.5).toFixed(2));

  const gridStepM = span <= 18 ? 1 : span <= 36 ? 2 : 5;
  const unitScale = Math.max(0.7, Math.min(2.8, span / 16));

  return {
    minX: boxMinX,
    minZ: boxMinZ,
    span,
    viewBox: `${boxMinX} ${boxMinZ} ${span} ${span}`,
    gridStepM,
    unitScale,
  };
}

/**
 * Computes 2D XZ frustum cone path, sightline, and optical focus bar for the Stage Camera.
 */
export function computeStageCameraMinimapGeometry(
  cameraPos: Vec3,
  cameraTarget: Vec3,
  fovDeg: number,
  aspectRatio: number,
  focusDistanceM: number,
  maxSpan: number,
  unitScale: number
): MinimapCameraGeometry {
  const camX = cameraPos.x;
  const camZ = cameraPos.z;
  const targetX = cameraTarget.x;
  const targetZ = cameraTarget.z;

  const dx = targetX - camX;
  const dz = targetZ - camZ;
  const distXZ = Math.hypot(dx, dz);
  const ndx = distXZ > 1e-4 ? dx / distXZ : 0;
  const ndz = distXZ > 1e-4 ? dz / distXZ : -1;

  // Perpendicular in XZ plane
  const px = -ndz;
  const pz = ndx;

  const safeFovDeg = Math.max(8, Math.min(130, fovDeg));
  const safeAspect = Math.max(0.5, Math.min(3.0, aspectRatio));
  const tanHalfHFov = safeAspect * Math.tan((safeFovDeg * Math.PI) / 360);

  const coneDist = Math.min(
    Math.max(distXZ * 0.9, 2.0 * unitScale),
    maxSpan * 0.45
  );
  const coneHalfWidth = Math.min(coneDist * tanHalfHFov, coneDist * 1.25);

  const leftX = camX + ndx * coneDist + px * coneHalfWidth;
  const leftZ = camZ + ndz * coneDist + pz * coneHalfWidth;
  const rightX = camX + ndx * coneDist - px * coneHalfWidth;
  const rightZ = camZ + ndz * coneDist - pz * coneHalfWidth;

  const conePath = `M ${camX.toFixed(2)} ${camZ.toFixed(2)} L ${leftX.toFixed(
    2
  )} ${leftZ.toFixed(2)} L ${rightX.toFixed(2)} ${rightZ.toFixed(2)} Z`;

  const clampedFocusDist = Math.max(
    0.35 * unitScale,
    Math.min(focusDistanceM, maxSpan * 0.6)
  );
  const fx = camX + ndx * clampedFocusDist;
  const fz = camZ + ndz * clampedFocusDist;
  const focusHalfBar = Math.max(
    0.45 * unitScale,
    Math.min(2.2 * unitScale, clampedFocusDist * tanHalfHFov * 0.55)
  );

  return {
    camX,
    camZ,
    targetX,
    targetZ,
    conePath,
    focusBar: {
      x1: fx + px * focusHalfBar,
      z1: fz + pz * focusHalfBar,
      x2: fx - px * focusHalfBar,
      z2: fz - pz * focusHalfBar,
      fx,
      fz,
    },
  };
}

/**
 * Computes 2D XZ Observer marker coordinates clamped neatly inside the radar border
 * when the user zooms outside the stage span.
 */
export function computeObserverMinimapGeometry(
  pose: SphericalPose,
  minX: number,
  minZ: number,
  span: number,
  unitScale: number
): MinimapObserverGeometry {
  const eye = sphericalToCartesian(pose).position;
  const pad = 0.75 * unitScale;
  const loX = minX + pad;
  const hiX = minX + span - pad;
  const loZ = minZ + pad;
  const hiZ = minZ + span - pad;

  const obsX = Math.max(loX, Math.min(hiX, eye.x));
  const obsZ = Math.max(loZ, Math.min(hiZ, eye.z));
  const isClamped = obsX !== eye.x || obsZ !== eye.z;

  const dx = pose.target.x - obsX;
  const dz = pose.target.z - obsZ;
  const dist = Math.hypot(dx, dz);
  const ndx = dist > 1e-4 ? dx / dist : 0;
  const ndz = dist > 1e-4 ? dz / dist : -1;
  const stubLen = Math.min(dist, 2.2 * unitScale);

  return {
    obsX,
    obsZ,
    targetX: pose.target.x,
    targetZ: pose.target.z,
    dirEndX: obsX + ndx * stubLen,
    dirEndZ: obsZ + ndz * stubLen,
    isClamped,
  };
}
