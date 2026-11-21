import { describe, expect, it } from 'vitest';
import {
  buildGroundTrailPoints,
  computeOrientedBoundingBox,
  resolveCueStartEndPivot,
  resolveLookAtPoint,
} from '../../src/core/entityKinematicUtils';
import {
  computeRotatedSubAnchorPoint,
  computeTiltedEntityLabelOffset,
  getEntityLookAnchor,
} from '../../src/core/cameraTargetResolver';
import { degToRad, rotateVec3YXZ } from '../../src/core/sphericalMath';
import { makeEntityDef, makeEntityState } from '../helpers/scoreFixtures';

describe('Entity Kinematic Utilities (entityKinematicUtils)', () => {
  it('resolves lookAt targets properly for string IDs, labels, center, and Vec3', () => {
    const currentPositions = new Map([
      ['lead', { x: 2, y: 1, z: -3 }],
      ['extra', { x: -4, y: 0, z: 5 }],
    ]);

    const entities = [
      makeEntityDef({ id: 'lead', label: 'Lead Actor', color: '#ffffff' }),
      makeEntityDef({ id: 'extra', label: 'Background Person', color: '#ffffff' }),
    ];

    // Explicit Vec3 object
    expect(resolveLookAtPoint({ x: 10, y: 2, z: 3 }, currentPositions, entities)).toEqual({
      x: 10,
      y: 2,
      z: 3,
    });

    // "center", "origin", "stage"
    expect(resolveLookAtPoint('center', currentPositions, entities)).toEqual({ x: 0, y: 0, z: 0 });
    expect(resolveLookAtPoint('Origin', currentPositions, entities)).toEqual({ x: 0, y: 0, z: 0 });
    expect(resolveLookAtPoint('STAGE', currentPositions, entities)).toEqual({ x: 0, y: 0, z: 0 });

    // Entity ID
    expect(resolveLookAtPoint('lead', currentPositions, entities)).toEqual({ x: 2, y: 1, z: -3 });
    expect(resolveLookAtPoint('LEAD', currentPositions, entities)).toEqual({ x: 2, y: 1, z: -3 });

    // Entity Label
    expect(resolveLookAtPoint('Background Person', currentPositions, entities)).toEqual({
      x: -4,
      y: 0,
      z: 5,
    });

    // Unmatched string & undefined
    expect(resolveLookAtPoint('nonexistent', currentPositions, entities)).toBeNull();
    expect(resolveLookAtPoint(undefined, currentPositions, entities)).toBeNull();
  });

  it('builds 16-segment (17 points) ground trails when displacement > 0.05m, empty otherwise', () => {
    const stationary = buildGroundTrailPoints({ x: 1, y: 0, z: 1 }, { x: 1.01, y: 0, z: 1.01 });
    expect(stationary).toHaveLength(0);

    const moving = buildGroundTrailPoints({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
    expect(moving).toHaveLength(17);
    expect(moving[0]).toEqual({ x: 0, y: 0.02, z: 0 });
    expect(moving[16]).toEqual({ x: 10, y: 0.02, z: 0 });
    expect(moving[8].x).toBeCloseTo(5.0, 4);
    expect(moving[8].y).toBe(0.02);
  });

  it('computes oriented 2D bounding boxes accurately under 0° and 90° yaw', () => {
    const obb0 = computeOrientedBoundingBox({ x: 2, z: 3 }, 4.0, 2.0, 0);
    expect(obb0).toHaveLength(4);
    expect(obb0[0].x).toBeCloseTo(0, 4);
    expect(obb0[0].z).toBeCloseTo(2, 4);
    expect(obb0[1].x).toBeCloseTo(4, 4);
    expect(obb0[1].z).toBeCloseTo(2, 4);
    expect(obb0[2].x).toBeCloseTo(4, 4);
    expect(obb0[2].z).toBeCloseTo(4, 4);
    expect(obb0[3].x).toBeCloseTo(0, 4);
    expect(obb0[3].z).toBeCloseTo(4, 4);

    // At 90° (Math.PI / 2) yaw: cos(90°) = 0, sin(90°) = 1
    const obb90 = computeOrientedBoundingBox({ x: 0, z: 0 }, 4.0, 2.0, Math.PI / 2);
    expect(obb90[0].x).toBeCloseTo(-1, 4);
    expect(obb90[0].z).toBeCloseTo(2, 4);
  });

  it('rotates getEntityLookAnchor in 3D via YXZ while preserving bit-for-bit upright coordinates', () => {
    const def = makeEntityDef({ id: 'hero', label: 'Hero', radius: 0.26 });

    // Upright: 0.9 * 1.75 = 1.575m
    const upright = getEntityLookAnchor(
      makeEntityState({
        id: 'hero',
        def,
        position: { x: 1, y: 0, z: -2 },
        rotationYRad: degToRad(35),
        pitchRad: 0,
        rollRad: 0,
      })
    );
    expect(upright).toEqual({ x: 1, y: 1.575, z: -2 });

    // Prone facing +Z (yaw = 0, pitch = +90deg): head extends +1.575m along +Z
    const proneZ = getEntityLookAnchor(
      makeEntityState({
        id: 'hero',
        def,
        position: { x: 0, y: 0.18, z: 0 },
        rotationYRad: 0,
        pitchRad: degToRad(90),
        rollRad: 0,
      })
    );
    expect(proneZ.x).toBeCloseTo(0, 4);
    expect(proneZ.y).toBeCloseTo(0.18, 4);
    expect(proneZ.z).toBeCloseTo(1.575, 4);

    // Prone facing +X (yaw = +90deg, pitch = +90deg): head extends +1.575m along +X
    const proneX = getEntityLookAnchor(
      makeEntityState({
        id: 'hero',
        def,
        position: { x: 0, y: 0.18, z: 0 },
        rotationYRad: degToRad(90),
        pitchRad: degToRad(90),
        rollRad: 0,
      })
    );
    expect(proneX.x).toBeCloseTo(1.575, 4);
    expect(proneX.y).toBeCloseTo(0.18, 4);
    expect(proneX.z).toBeCloseTo(0, 4);

    // Supine facing +Z (yaw = 0, pitch = -90deg): head extends -1.575m along -Z
    const supineZ = getEntityLookAnchor(
      makeEntityState({
        id: 'hero',
        def,
        position: { x: 0, y: 0.2, z: 0 },
        rotationYRad: 0,
        pitchRad: degToRad(-90),
        rollRad: 0,
      })
    );
    expect(supineZ.x).toBeCloseTo(0, 4);
    expect(supineZ.y).toBeCloseTo(0.2, 4);
    expect(supineZ.z).toBeCloseTo(-1.575, 4);

    // Pure roll = +90deg around +Z: head leans toward -X
    const rolled = getEntityLookAnchor(
      makeEntityState({
        id: 'hero',
        def,
        position: { x: 1, y: 0, z: 2 },
        rotationYRad: 0,
        pitchRad: 0,
        rollRad: degToRad(90),
      })
    );
    expect(rolled.x).toBeCloseTo(1 - 1.575, 4);
    expect(rolled.y).toBeCloseTo(0, 4);
    expect(rolled.z).toBeCloseTo(2, 4);

    // Combined yaw + pitch + roll with crouched live size.y = 1.0m (0.9 * 1.0 = 0.9m)
    const combinedYaw = degToRad(35);
    const combinedPitch = degToRad(-40);
    const combinedRoll = degToRad(25);
    const expectedRot = rotateVec3YXZ(
      { x: 0, y: 0.9, z: 0 },
      combinedYaw,
      combinedPitch,
      combinedRoll
    );
    const crouchedTilted = getEntityLookAnchor(
      makeEntityState({
        id: 'hero',
        def,
        position: { x: -1, y: 0.5, z: 3 },
        rotationYRad: combinedYaw,
        pitchRad: combinedPitch,
        rollRad: combinedRoll,
        size: { x: 0.52, y: 1.0, z: 0.52 },
      })
    );
    expect(crouchedTilted.x).toBeCloseTo(-1 + expectedRot.x, 6);
    expect(crouchedTilted.y).toBeCloseTo(0.5 + expectedRot.y, 6);
    expect(crouchedTilted.z).toBeCloseTo(3 + expectedRot.z, 6);

    // Prop (0.5 * height) & Marker (0.5 * height) tilted anchors
    const propAnchor = getEntityLookAnchor(
      makeEntityState({
        id: 'crate',
        def: { ...def, id: 'crate', kind: 'prop', height: 1.2 },
        position: { x: 2, y: 0, z: -1 },
        rotationYRad: degToRad(90),
        pitchRad: degToRad(90),
        rollRad: 0,
      })
    );
    expect(propAnchor.x).toBeCloseTo(2.6, 4);
    expect(propAnchor.y).toBeCloseTo(0, 4);
    expect(propAnchor.z).toBeCloseTo(-1, 4);

    const markerAnchor = getEntityLookAnchor(
      makeEntityState({
        id: 'spike',
        def: { ...def, id: 'spike', kind: 'marker', height: 0.4 },
        position: { x: -2, y: 0, z: 1 },
        rotationYRad: 0,
        pitchRad: 0,
        rollRad: degToRad(-90),
      })
    );
    expect(markerAnchor.x).toBeCloseTo(-1.8, 4);
    expect(markerAnchor.y).toBeCloseTo(0, 4);
    expect(markerAnchor.z).toBeCloseTo(1, 4);
  });

  it('resolves dot-notation sub-anchors in resolveLookAtPoint with graceful fallback (#19)', () => {
    const currentPositions = new Map([['hero', { x: 0, y: 0, z: 0 }]]);
    const currentPoses = new Map([
      [
        'hero',
        { rotationYRad: 0, pitchRad: degToRad(90), rollRad: 0, size: { x: 1.0, y: 2.0, z: 0.5 } },
      ],
    ]);
    const entities = [
      makeEntityDef({ id: 'hero', label: 'Hero', width: 1.0, height: 2.0, radius: 0.5 }),
    ];

    // Prone hero (pitch=90, h=2.0): .head is at (0, 0, +1.8), .feet at (0, 0, +0.1)
    const headPt = resolveLookAtPoint('hero.head', currentPositions, entities, currentPoses)!;
    expect(headPt.x).toBeCloseTo(0, 4);
    expect(headPt.y).toBeCloseTo(0, 4);
    expect(headPt.z).toBeCloseTo(1.8, 4);

    const feetPt = resolveLookAtPoint('hero.feet', currentPositions, entities, currentPoses)!;
    expect(feetPt.z).toBeCloseTo(0.1, 4);

    // Upright hero facing +Z: .shoulder_l is anatomical left (+X = +0.40 * width = +0.40m)
    const uprightPoses = new Map([
      ['hero', { rotationYRad: 0, pitchRad: 0, rollRad: 0, size: { x: 1.0, y: 2.0, z: 0.5 } }],
    ]);
    const leftShoulder = resolveLookAtPoint(
      'hero.shoulder_l',
      currentPositions,
      entities,
      uprightPoses
    )!;
    expect(leftShoulder.x).toBeCloseTo(0.4, 4);
    expect(leftShoulder.y).toBeCloseTo(1.54, 4);
    expect(leftShoulder.z).toBeCloseTo(0, 4);

    const rightShoulder = resolveLookAtPoint(
      'hero.shoulder_r',
      currentPositions,
      entities,
      uprightPoses
    )!;
    expect(rightShoulder.x).toBeCloseTo(-0.4, 4);

    // Upright "hero.typo" falls back identically to bare "hero"
    const barePt = resolveLookAtPoint('hero', currentPositions, entities, uprightPoses);
    const typoPt = resolveLookAtPoint('hero.typo', currentPositions, entities, uprightPoses);
    expect(typoPt).toEqual(barePt);
  });

  it('rotates entity sub-anchors around custom vertical pivot ratios while remaining upright-invariant (#20)', () => {
    const pos = { x: 1.5, y: 3.0, z: -2.0 };
    const w = 0.6;
    const h = 1.8;

    // 1. Upright invariance (pitch=0, roll=0): pivot=0, 0.5, 1.0 yield identical anchors
    for (const part of [undefined, 'head', 'chest', 'shoulder_l', 'waist', 'feet', 'top']) {
      const baseAnchor = computeRotatedSubAnchorPoint(pos, 'character', w, h, 0.7, 0, 0, part, 0);
      const centerAnchor = computeRotatedSubAnchorPoint(
        pos,
        'character',
        w,
        h,
        0.7,
        0,
        0,
        part,
        0.5
      );
      const topAnchor = computeRotatedSubAnchorPoint(pos, 'character', w, h, 0.7, 0, 0, part, 1.0);
      expect(centerAnchor.x).toBeCloseTo(baseAnchor.x, 6);
      expect(centerAnchor.y).toBeCloseTo(baseAnchor.y, 6);
      expect(centerAnchor.z).toBeCloseTo(baseAnchor.z, 6);
      expect(topAnchor.x).toBeCloseTo(baseAnchor.x, 6);
      expect(topAnchor.y).toBeCloseTo(baseAnchor.y, 6);
      expect(topAnchor.z).toBeCloseTo(baseAnchor.z, 6);
    }

    // 2. Center-pivoted prop (pivot=0.5, default anchor=0.5h): stationary under arbitrary 3D rotation
    for (const [yawDeg, pitchDeg, rollDeg] of [
      [0, 90, 0],
      [45, -60, 30],
      [-120, 145, -75],
    ]) {
      const anchor = computeRotatedSubAnchorPoint(
        pos,
        'prop',
        1.2,
        h,
        degToRad(yawDeg),
        degToRad(pitchDeg),
        degToRad(rollDeg),
        undefined,
        0.5
      );
      expect(anchor.x).toBeCloseTo(pos.x, 6);
      expect(anchor.y).toBeCloseTo(pos.y + 0.5 * h, 6);
      expect(anchor.z).toBeCloseTo(pos.z, 6);
    }

    // 3. Center-pivoted flying character (h=1.8m at y=3.0 -> pivot at y=3.9m, pitch=90deg forward +Z)
    const flyingHead = computeRotatedSubAnchorPoint(
      pos,
      'character',
      w,
      h,
      0,
      degToRad(90),
      0,
      undefined,
      0.5
    );
    expect(flyingHead.x).toBeCloseTo(1.5, 5);
    expect(flyingHead.y).toBeCloseTo(3.9, 5);
    expect(flyingHead.z).toBeCloseTo(-1.28, 5);

    // .feet (0.05h = 0.09m -> -0.81m from pivot) rotates backward to (1.5, 3.9, -2.0 - 0.81)
    const flyingFeet = computeRotatedSubAnchorPoint(
      pos,
      'character',
      w,
      h,
      0,
      degToRad(90),
      0,
      'feet',
      0.5
    );
    expect(flyingFeet.x).toBeCloseTo(1.5, 5);
    expect(flyingFeet.y).toBeCloseTo(3.9, 5);
    expect(flyingFeet.z).toBeCloseTo(-2.81, 5);

    // Direct unit check on resolveCueStartEndPivot for 360-degree (2*PI) upright equivalence
    expect(resolveCueStartEndPivot(0.5, 0, Math.PI * 2, 0, false)).toEqual({
      startPivot: 0.5,
      endPivot: 0.5,
    });
    expect(resolveCueStartEndPivot(0.5, 0, Math.PI, Math.PI, false)).toEqual({
      startPivot: 0.5,
      endPivot: 0.5,
    });
  });

  it('computes kind-aware floating label offsets for pivoted and inverted entities (#20)', () => {
    expect(computeTiltedEntityLabelOffset('character', undefined, 0.5, 1.8, 0.5, 0, 0, 0.5)).toEqual(
      {
        x: 0,
        y: 2.08,
        z: 0,
      }
    );

    // Character at pivot=0.5, pitch=90deg (horizontal flight +Z): crown at (0, 0.5h, +0.5h)
    const charFlight = computeTiltedEntityLabelOffset(
      'character',
      undefined,
      0.5,
      1.8,
      0.5,
      degToRad(90),
      0,
      0.5
    );
    expect(charFlight.x).toBeCloseTo(0, 5);
    expect(charFlight.y).toBeCloseTo(0.9 + 0.28, 5);
    expect(charFlight.z).toBeCloseTo(0.9, 5);

    // Character inverted upside down (pivot=0.5, pitch=180deg): clamped above baseY (=1.8m)
    const charInverted = computeTiltedEntityLabelOffset(
      'character',
      undefined,
      0.5,
      1.8,
      0.5,
      degToRad(180),
      0,
      0.5
    );
    expect(charInverted.y).toBeCloseTo(1.8 + 0.28, 5);

    // Sphere prop (w=h=d=1.0, pivot=0.5) stays invariant at (0, 1.0 + 0.28, 0) under any tilt
    const sphereLabel = computeTiltedEntityLabelOffset(
      'prop',
      'sphere',
      1.0,
      1.0,
      1.0,
      degToRad(53),
      degToRad(-37),
      0.5
    );
    expect(sphereLabel.x).toBeCloseTo(0, 5);
    expect(sphereLabel.y).toBeCloseTo(1.28, 5);
    expect(sphereLabel.z).toBeCloseTo(0, 5);

    // Box prop (w=2.0, h=0.8, d=1.0, pivot=0.5, pitch=90deg): center at y=0.4, depth half-extent rz=0.5 -> 1.18m
    const boxLabel = computeTiltedEntityLabelOffset(
      'prop',
      'box',
      2.0,
      0.8,
      1.0,
      degToRad(90),
      0,
      0.5
    );
    expect(boxLabel.x).toBeCloseTo(0, 5);
    expect(boxLabel.y).toBeCloseTo(1.18, 5);
    expect(boxLabel.z).toBeCloseTo(0, 5);
  });
});
