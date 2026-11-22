import { describe, expect, it } from 'vitest';
import {
  computeDioramaMinimapBounds,
  computeObserverMinimapGeometry,
  computeStageCameraMinimapGeometry,
} from '../../src/core/minimapMath';
import { makeEntityDef, makePose, makeScore } from '../helpers/scoreFixtures';

describe('minimapMath', () => {
  it('computes padded static viewBox bounds across entities and shot keyframes', () => {
    const score = makeScore({
      entities: [
        makeEntityDef({ id: 'hero', position: { x: -4, y: 0, z: -2 } }),
        makeEntityDef({ id: 'rival', position: { x: 4, y: 0, z: 3 } }),
      ],
    });

    const bounds = computeDioramaMinimapBounds(score);
    expect(bounds.span).toBeGreaterThanOrEqual(12);
    expect(bounds.gridStepM).toBe(1);
    expect(bounds.viewBox).toBe(
      `${bounds.minX} ${bounds.minZ} ${bounds.span} ${bounds.span}`
    );
  });

  it('computes Stage Camera cone path and perpendicular focus bar along XZ sightline', () => {
    const geom = computeStageCameraMinimapGeometry(
      { x: 0, y: 1.6, z: 6 },
      { x: 0, y: 1.2, z: 0 },
      40,
      16 / 9,
      3,
      16,
      1
    );

    expect(geom.camX).toBe(0);
    expect(geom.camZ).toBe(6);
    expect(geom.conePath.startsWith('M 0.00 6.00 L ')).toBe(true);
    // Moving 3m from z=6 toward z=0 puts focus bar at z=3, aligned horizontally in X
    expect(geom.focusBar.fx).toBeCloseTo(0, 4);
    expect(geom.focusBar.fz).toBeCloseTo(3, 4);
    expect(geom.focusBar.z1).toBeCloseTo(3, 4);
    expect(geom.focusBar.z2).toBeCloseTo(3, 4);
    expect(geom.focusBar.x1).toBeGreaterThan(0);
    expect(geom.focusBar.x2).toBeLessThan(0);
  });

  it('clamps Observer marker inside radar bounds when zoomed far out', () => {
    const pose = makePose({
      target: { x: 0, y: 1.1, z: 0 },
      distance: 45,
      pitch: 0.2,
      yaw: 0,
    });

    const obs = computeObserverMinimapGeometry(pose, -8, -8, 16, 1);
    expect(obs.isClamped).toBe(true);
    expect(obs.obsZ).toBeLessThanOrEqual(8);
    expect(obs.dirEndZ).toBeLessThan(obs.obsZ);
  });
});
