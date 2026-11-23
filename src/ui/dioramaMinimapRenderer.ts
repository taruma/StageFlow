/**
 * Imperative SVG Attribute Updater for DioramaMinimap.
 * Mutates SVG element refs directly from live 60fps StageFrame & SphericalPose
 * without triggering React re-renders.
 * Layer 5 UI Utility.
 */

import { computeOrientedBoundingBox } from '../core/entityKinematicUtils';
import {
  computeObserverMinimapGeometry,
  computeStageCameraMinimapGeometry,
  type MinimapBounds,
} from '../core/minimapMath';
import { radToDeg } from '../core/sphericalMath';
import type {
  CameraViewMode,
  SphericalPose,
  StageFrame,
  StageScore,
} from '../core/types';

export interface MinimapEntityDomRefs {
  group: SVGGElement | null;
  halo: SVGCircleElement | null;
  circle: SVGCircleElement | null;
  ellipse: SVGEllipseElement | null;
  polygon: SVGPolygonElement | null;
  facing: SVGLineElement | null;
  marker: SVGPathElement | null;
}

export interface MinimapSvgRefs {
  obsGroup: SVGGElement | null;
  obsLine: SVGLineElement | null;
  obsDot: SVGCircleElement | null;
  camCone: SVGPathElement | null;
  camSightLine: SVGLineElement | null;
  camFocusBar: SVGLineElement | null;
  camFocusDot: SVGCircleElement | null;
  camDot: SVGCircleElement | null;
  entities: Record<string, MinimapEntityDomRefs>;
}

export function applyStageFrameToMinimapRefs(
  refs: MinimapSvgRefs,
  liveFrame: StageFrame,
  activePose: SphericalPose,
  score: StageScore,
  bounds: MinimapBounds,
  cameraMode: CameraViewMode
): void {
  const { minX, minZ, span, unitScale } = bounds;

  // 1. Observer Camera marker (hidden in Stage Cam POV)
  if (refs.obsGroup) {
    if (cameraMode === 'stage-pov') {
      refs.obsGroup.style.display = 'none';
    } else {
      refs.obsGroup.style.display = '';
      const obs = computeObserverMinimapGeometry(
        activePose,
        minX,
        minZ,
        span,
        unitScale
      );
      if (refs.obsLine) {
        refs.obsLine.setAttribute('x1', obs.obsX.toFixed(2));
        refs.obsLine.setAttribute('y1', obs.obsZ.toFixed(2));
        refs.obsLine.setAttribute('x2', obs.dirEndX.toFixed(2));
        refs.obsLine.setAttribute('y2', obs.dirEndZ.toFixed(2));
      }
      if (refs.obsDot) {
        refs.obsDot.setAttribute('cx', obs.obsX.toFixed(2));
        refs.obsDot.setAttribute('cy', obs.obsZ.toFixed(2));
        refs.obsDot.setAttribute('fill-opacity', obs.isClamped ? '0.45' : '1');
      }
    }
  }

  // 2. Stage Camera cone, sightline, focus plane bar & glyph
  const stageCam = liveFrame.stageCamera;
  const camGeom = computeStageCameraMinimapGeometry(
    stageCam.transform.position,
    stageCam.transform.target,
    stageCam.transform.fovDeg,
    score.aspectRatio,
    stageCam.dof.focusDistanceM,
    span,
    unitScale
  );

  refs.camCone?.setAttribute('d', camGeom.conePath);
  if (refs.camSightLine) {
    refs.camSightLine.setAttribute('x1', camGeom.camX.toFixed(2));
    refs.camSightLine.setAttribute('y1', camGeom.camZ.toFixed(2));
    refs.camSightLine.setAttribute('x2', camGeom.targetX.toFixed(2));
    refs.camSightLine.setAttribute('y2', camGeom.targetZ.toFixed(2));
  }
  if (refs.camFocusBar) {
    refs.camFocusBar.setAttribute('x1', camGeom.focusBar.x1.toFixed(2));
    refs.camFocusBar.setAttribute('y1', camGeom.focusBar.z1.toFixed(2));
    refs.camFocusBar.setAttribute('x2', camGeom.focusBar.x2.toFixed(2));
    refs.camFocusBar.setAttribute('y2', camGeom.focusBar.z2.toFixed(2));
  }
  if (refs.camFocusDot) {
    refs.camFocusDot.setAttribute('cx', camGeom.focusBar.fx.toFixed(2));
    refs.camFocusDot.setAttribute('cy', camGeom.focusBar.fz.toFixed(2));
  }
  if (refs.camDot) {
    refs.camDot.setAttribute('cx', camGeom.camX.toFixed(2));
    refs.camDot.setAttribute('cy', camGeom.camZ.toFixed(2));
  }

  // 3. Live entities (current state only, no trails)
  for (const def of score.entities) {
    const bucket = refs.entities[def.id];
    if (!bucket?.group) continue;
    const ent = liveFrame.entitiesById.get(def.id);
    if (!ent || !ent.visible) {
      bucket.group.style.display = 'none';
      continue;
    }
    bucket.group.style.display = '';

    const x = ent.position.x;
    const z = ent.position.z;
    const liveWidth = ent.size?.x ?? def.width ?? def.radius * 2;
    const liveDepth = ent.size?.z ?? def.depth ?? def.radius * 2;

    if (def.kind === 'marker') {
      bucket.marker?.setAttribute(
        'transform',
        `translate(${x.toFixed(2)}, ${z.toFixed(2)})`
      );
      continue;
    }

    if (def.kind === 'prop') {
      const isCircular =
        def.shape === 'sphere' ||
        def.shape === 'cylinder' ||
        def.shape === 'capsule';
      if (isCircular && bucket.ellipse) {
        const rx = Math.max(0.22 * unitScale, liveWidth * 0.5);
        const rz = Math.max(0.22 * unitScale, liveDepth * 0.5);
        const deg = -radToDeg(ent.rotationYRad);
        bucket.ellipse.setAttribute('cx', x.toFixed(2));
        bucket.ellipse.setAttribute('cy', z.toFixed(2));
        bucket.ellipse.setAttribute('rx', rx.toFixed(2));
        bucket.ellipse.setAttribute('ry', rz.toFixed(2));
        bucket.ellipse.setAttribute(
          'transform',
          `rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${z.toFixed(2)})`
        );
      } else if (bucket.polygon) {
        const corners = computeOrientedBoundingBox(
          { x, z },
          Math.max(0.35 * unitScale, liveWidth),
          Math.max(0.35 * unitScale, liveDepth),
          ent.rotationYRad
        );
        bucket.polygon.setAttribute(
          'points',
          corners.map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)}`).join(' ')
        );
      }
      continue;
    }

    const r = Math.max(0.3 * unitScale, liveWidth * 0.5);
    const facingLen = Math.max(0.75 * unitScale, liveWidth * 0.9);
    const fx = x + Math.sin(ent.rotationYRad) * facingLen;
    const fz = z + Math.cos(ent.rotationYRad) * facingLen;

    if (bucket.halo) {
      bucket.halo.setAttribute('cx', x.toFixed(2));
      bucket.halo.setAttribute('cy', z.toFixed(2));
      bucket.halo.setAttribute('r', (r * 1.55).toFixed(2));
      bucket.halo.setAttribute('opacity', ent.highlighted ? '0.9' : '0');
    }
    if (bucket.circle) {
      bucket.circle.setAttribute('cx', x.toFixed(2));
      bucket.circle.setAttribute('cy', z.toFixed(2));
      bucket.circle.setAttribute('r', r.toFixed(2));
    }
    if (bucket.facing) {
      bucket.facing.setAttribute('x1', x.toFixed(2));
      bucket.facing.setAttribute('y1', z.toFixed(2));
      bucket.facing.setAttribute('x2', fx.toFixed(2));
      bucket.facing.setAttribute('y2', fz.toFixed(2));
    }
  }
}
