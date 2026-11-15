import { describe, expect, it } from 'vitest';
import type { StageScore } from '../../src/core/types';
import {
  buildGroundTrailPoints,
  evaluateBlockingEntitiesAtTime,
  evaluateEntitiesAtTime,
  evaluateLegacyEntitiesAtTime,
  resolveLookAtPoint,
} from '../../src/core/entityEngine';
import { computeOrientedBoundingBox } from '../../src/core/entityKinematicUtils';
import { getEntityLookAnchor } from '../../src/core/cameraTargetResolver';
import { degToRad, shortestAngleDiff } from '../../src/core/sphericalMath';

describe('Entity Kinematic Utilities (entityKinematicUtils)', () => {
  it('resolves lookAt targets properly for string IDs, labels, center, and Vec3', () => {
    const currentPositions = new Map([
      ['lead', { x: 2, y: 1, z: -3 }],
      ['extra', { x: -4, y: 0, z: 5 }],
    ]);

    const entities = [
      {
        id: 'lead',
        label: 'Lead Actor',
        kind: 'character' as const,
        position: { x: 0, y: 0, z: 0 },
        rotationYRad: 0,
        height: 1.75,
        radius: 0.28,
        color: '#ffffff',
      },
      {
        id: 'extra',
        label: 'Background Person',
        kind: 'character' as const,
        position: { x: 0, y: 0, z: 0 },
        rotationYRad: 0,
        height: 1.75,
        radius: 0.28,
        color: '#ffffff',
      },
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

    // Unmatched string
    expect(resolveLookAtPoint('nonexistent', currentPositions, entities)).toBeNull();

    // Undefined / empty
    expect(resolveLookAtPoint(undefined, currentPositions, entities)).toBeNull();
  });

  it('builds 16-segment (17 points) ground trails when displacement > 0.05m, empty otherwise', () => {
    // Zero / negligible movement
    const stationary = buildGroundTrailPoints({ x: 1, y: 0, z: 1 }, { x: 1.01, y: 0, z: 1.01 });
    expect(stationary).toHaveLength(0);

    // Displaced movement
    const moving = buildGroundTrailPoints({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
    expect(moving).toHaveLength(17);
    expect(moving[0]).toEqual({ x: 0, y: 0.02, z: 0 });
    expect(moving[16]).toEqual({ x: 10, y: 0.02, z: 0 });
    expect(moving[8].x).toBeCloseTo(5.0, 4);
    expect(moving[8].y).toBe(0.02);
  });
});

describe('Entity Engine Facade & Dispatching (entityEngine)', () => {
  const baseScore: StageScore = {
    version: '1.0',
    id: 'test-score',
    title: 'Test Score',
    videoUrl: 'procedural://demo',
    aspectRatio: 16 / 9,
    durationSec: 10.0,
    offsetSec: 0,
    stage: {
      width: 10,
      depth: 10,
      gridStep: 1,
      defaultObserverPose: {
        target: { x: 0, y: 1, z: 0 },
        distance: 7,
        pitch: 0.3,
        yaw: 0.4,
        roll: 0,
        focalLengthMm: 35,
      },
      defaultStageCameraPose: {
        target: { x: 0, y: 1, z: 0 },
        distance: 3.5,
        pitch: 0.1,
        yaw: 0,
        roll: 0,
        focalLengthMm: 50,
      },
    },
    entities: [
      {
        id: 'actor',
        label: 'Actor',
        kind: 'character',
        position: { x: -2, y: 0, z: 0 },
        rotationYRad: 0,
        height: 1.75,
        radius: 0.28,
        color: '#38bdf8',
      },
    ],
    shots: [
      {
        id: 'shot-1',
        shotNumber: 1,
        label: 'Shot 1',
        description: 'Test Shot',
        startSec: 0,
        endSec: 10,
        entities: {
          actor: {
            position: { x: 2, y: 0, z: 0 },
            easing: 'linear',
            highlighted: false,
            visible: true,
          },
        },
      },
    ],
  };

  it('delegates to Tier 2 legacy evaluator when blocking is undefined', () => {
    const res = evaluateEntitiesAtTime(5.0, baseScore);
    const actor = res.entitiesById.get('actor')!;
    expect(actor.position.x).toBeCloseTo(0.0, 3);
    expect(actor.cueId).toBe('shot-1');
  });

  it('delegates to Tier 1 decoupled blocking evaluator when blocking is defined', () => {
    const blockingScore: StageScore = {
      ...baseScore,
      blocking: [
        {
          id: 'cue-cross',
          entityId: 'actor',
          startSec: 0,
          endSec: 10,
          position: { x: 8, y: 0, z: 0 },
          easing: 'linear',
        },
      ],
    };

    const res = evaluateEntitiesAtTime(5.0, blockingScore);
    const actor = res.entitiesById.get('actor')!;
    // Walk from -2 to +8 over 10s: at 5s, x = 3.0
    expect(actor.position.x).toBeCloseTo(3.0, 3);
    expect(actor.cueId).toBe('cue-cross');
  });

  it('direct calls to evaluateBlockingEntitiesAtTime and evaluateLegacyEntitiesAtTime work identically', () => {
    const legacyRes = evaluateLegacyEntitiesAtTime(5.0, baseScore);
    expect(legacyRes.entitiesById.get('actor')!.position.x).toBeCloseTo(0.0, 3);

    const blockingScore: StageScore = {
      ...baseScore,
      blocking: [
        {
          id: 'cue-cross',
          entityId: 'actor',
          startSec: 0,
          endSec: 10,
          position: { x: 8, y: 0, z: 0 },
          easing: 'linear',
        },
      ],
    };
    const blockingRes = evaluateBlockingEntitiesAtTime(5.0, blockingScore);
    expect(blockingRes.entitiesById.get('actor')!.position.x).toBeCloseTo(3.0, 3);
  });

  it('evaluates cut: true as instant placement with empty trailPoints and no cross-stage sliding', () => {
    const cutScore: StageScore = {
      ...baseScore,
      blocking: [
        // Cue 1: walk from baseline (-2, 0, 0) to (4, 0, 0) over 0s to 5s
        {
          id: 'cue-walk',
          entityId: 'actor',
          startSec: 0,
          endSec: 5,
          position: { x: 4, y: 0, z: 0 },
          easing: 'linear',
        },
        // Cue 2: jump cut to (-10, 0, 5) with cut: true over 5s to 10s
        {
          id: 'cue-jump-cut',
          entityId: 'actor',
          startSec: 5,
          endSec: 10,
          cut: true,
          position: { x: -10, y: 0, z: 5 },
          rotationYRad: Math.PI / 2,
          easing: 'smooth',
        },
        // Cue 3: continuous walk from (-10, 0, 5) to (-15, 0, 5) over 10s to 15s (from omitted!)
        {
          id: 'cue-walk-post-cut',
          entityId: 'actor',
          startSec: 10,
          endSec: 15,
          position: { x: -15, y: 0, z: 5 },
          easing: 'linear',
        },
      ],
    };

    // At 4.9s: actor is still near end of cue-walk (x ~ 3.88)
    const resAt49 = evaluateBlockingEntitiesAtTime(4.9, cutScore);
    const actorAt49 = resAt49.entitiesById.get('actor')!;
    expect(actorAt49.position.x).toBeCloseTo(3.88, 1);
    expect(actorAt49.trailPoints.length).toBeGreaterThan(0); // Active walk trail

    // At 5.0s (exact boundary of cut): actor immediately manifests at (-10, 0, 5) without sliding
    const resAt50 = evaluateBlockingEntitiesAtTime(5.0, cutScore);
    const actorAt50 = resAt50.entitiesById.get('actor')!;
    expect(actorAt50.position).toEqual({ x: -10, y: 0, z: 5 });
    expect(actorAt50.trailPoints).toHaveLength(0); // Suppressed trail!
    expect(actorAt50.rotationYRad).toBeCloseTo(Math.PI / 2, 4);

    // At 7.5s (mid-cue of jump-cut): actor remains exactly at (-10, 0, 5)
    const resAt75 = evaluateBlockingEntitiesAtTime(7.5, cutScore);
    const actorAt75 = resAt75.entitiesById.get('actor')!;
    expect(actorAt75.position).toEqual({ x: -10, y: 0, z: 5 });
    expect(actorAt75.trailPoints).toHaveLength(0);

    // At 12.5s (mid-cue of walk post-cut): actor smoothly walks from (-10, 0, 5) to (-15, 0, 5) -> x = -12.5
    const resAt125 = evaluateBlockingEntitiesAtTime(12.5, cutScore);
    const actorAt125 = resAt125.entitiesById.get('actor')!;
    expect(actorAt125.position.x).toBeCloseTo(-12.5, 3);
    expect(actorAt125.position.z).toBeCloseTo(5.0, 3);
    expect(actorAt125.trailPoints.length).toBeGreaterThan(0); // Trail resumes for normal walk!
  });

  it('evaluates Tier 2 legacy entity cut: true without sliding and with empty trailPoints', () => {
    const legacyCutScore: StageScore = {
      ...baseScore,
      shots: [
        {
          id: 'shot-1',
          shotNumber: 1,
          label: 'Shot 1',
          description: 'Shot 1',
          startSec: 0,
          endSec: 5,
          entities: {
            actor: {
              position: { x: 5, y: 0, z: 0 },
              easing: 'linear',
              highlighted: false,
              visible: true,
            },
          },
        },
        {
          id: 'shot-2',
          shotNumber: 2,
          label: 'Shot 2',
          description: 'Shot 2 Cut',
          startSec: 5,
          endSec: 10,
          entities: {
            actor: {
              cut: true,
              position: { x: -20, y: 0, z: 0 },
              easing: 'smooth',
              highlighted: false,
              visible: true,
            },
          },
        },
      ],
    };

    // At 5.0s: actor is immediately placed at (-20, 0, 0)
    const resAt50 = evaluateLegacyEntitiesAtTime(5.0, legacyCutScore);
    const actorAt50 = resAt50.entitiesById.get('actor')!;
    expect(actorAt50.position).toEqual({ x: -20, y: 0, z: 0 });
    expect(actorAt50.trailPoints).toHaveLength(0); // Empty trail for cut shot

    // At 7.5s: actor holds at (-20, 0, 0)
    const resAt75 = evaluateLegacyEntitiesAtTime(7.5, legacyCutScore);
    const actorAt75 = resAt75.entitiesById.get('actor')!;
    expect(actorAt75.position).toEqual({ x: -20, y: 0, z: 0 });
    expect(actorAt75.trailPoints).toHaveLength(0);
  });

  describe('3D Entity Dimensions, Oriented Bounding Box & Blocking Transforms', () => {
    it('computes oriented 2D bounding boxes accurately under 0° and 90° yaw', () => {
      // At 0 rad yaw: local +X is world +X, local +Z is world +Z
      const obb0 = computeOrientedBoundingBox({ x: 2, z: 3 }, 4.0, 2.0, 0);
      expect(obb0).toHaveLength(4);

      // Corners: (-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)
      // center (2, 3) + (-2, -1) = (0, 2)
      expect(obb0[0].x).toBeCloseTo(0, 4);
      expect(obb0[0].z).toBeCloseTo(2, 4);
      // center (2, 3) + (2, -1) = (4, 2)
      expect(obb0[1].x).toBeCloseTo(4, 4);
      expect(obb0[1].z).toBeCloseTo(2, 4);
      // center (2, 3) + (2, 1) = (4, 4)
      expect(obb0[2].x).toBeCloseTo(4, 4);
      expect(obb0[2].z).toBeCloseTo(4, 4);
      // center (2, 3) + (-2, 1) = (0, 4)
      expect(obb0[3].x).toBeCloseTo(0, 4);
      expect(obb0[3].z).toBeCloseTo(4, 4);

      // At 90° (Math.PI / 2) yaw:
      // cos(90°) = 0, sin(90°) = 1
      // rx = -dz, rz = dx
      const obb90 = computeOrientedBoundingBox({ x: 0, z: 0 }, 4.0, 2.0, Math.PI / 2);
      expect(obb90[0].x).toBeCloseTo(-1, 4); // local (-2, -1) -> x = -hw*cos + -hd*sin = 0 - 1 = -1
      expect(obb90[0].z).toBeCloseTo(2, 4); // z = - (-hw)*sin + -hd*cos = -(-2)*1 + 0 = 2
    });

    it('interpolates dimensions at 60fps and forward-chains individual axes across cues', () => {
      const dimensionScore: StageScore = {
        ...baseScore,
        entities: [
          {
            id: 'actor',
            label: 'Actor',
            kind: 'character',
            position: { x: 0, y: 0, z: 0 },
            rotationYRad: 0,
            width: 0.52,
            height: 1.75,
            depth: 0.52,
            radius: 0.26,
            color: '#ffffff',
          },
        ],
        blocking: [
          // Cue 1 (0s - 4s): crouch down to height: 1.05 with linear easing
          {
            id: 'cue-crouch',
            entityId: 'actor',
            startSec: 0,
            endSec: 4,
            height: 1.05,
            easing: 'linear',
          },
          // Cue 2 (4s - 8s): widen stance to width: 0.80, height omitted!
          {
            id: 'cue-widen',
            entityId: 'actor',
            startSec: 4,
            endSec: 8,
            width: 0.80,
            easing: 'linear',
          },
        ],
      };

      // At t = 0s: initial baseline dimensions
      const at0 = evaluateBlockingEntitiesAtTime(0, dimensionScore);
      const actor0 = at0.entitiesById.get('actor')!;
      expect(actor0.size).toBeDefined();
      expect(actor0.size!.x).toBeCloseTo(0.52, 3);
      expect(actor0.size!.y).toBeCloseTo(1.75, 3);
      expect(actor0.size!.z).toBeCloseTo(0.52, 3);

      // At t = 2s (mid-crouch): height is halfway between 1.75 and 1.05 = 1.40
      const at2 = evaluateBlockingEntitiesAtTime(2, dimensionScore);
      const actor2 = at2.entitiesById.get('actor')!;
      expect(actor2.size!.y).toBeCloseTo(1.40, 3);
      expect(actor2.size!.x).toBeCloseTo(0.52, 3);
      expect(actor2.size!.z).toBeCloseTo(0.52, 3);

      // At t = 4s (end of crouch): height is 1.05
      const at4 = evaluateBlockingEntitiesAtTime(4, dimensionScore);
      const actor4 = at4.entitiesById.get('actor')!;
      expect(actor4.size!.y).toBeCloseTo(1.05, 3);

      // At t = 6s (mid-widen in Cue 2):
      // Height should be PRESERVED at 1.05m (not reset to baseline 1.75m!)
      // Width should be halfway between 0.52 and 0.80 = 0.66
      const at6 = evaluateBlockingEntitiesAtTime(6, dimensionScore);
      const actor6 = at6.entitiesById.get('actor')!;
      expect(actor6.size!.y).toBeCloseTo(1.05, 3);
      expect(actor6.size!.x).toBeCloseTo(0.66, 3);
      expect(actor6.size!.z).toBeCloseTo(0.52, 3);

      // At t = 8s: full widen
      const at8 = evaluateBlockingEntitiesAtTime(8, dimensionScore);
      const actor8 = at8.entitiesById.get('actor')!;
      expect(actor8.size!.y).toBeCloseTo(1.05, 3);
      expect(actor8.size!.x).toBeCloseTo(0.80, 3);
    });

    it('evaluates pitch & roll across prone -> wake up -> fly/bank with shortest-arc wrapping, look_at independence, and cut snap', () => {
      const tiltBlockingScore: StageScore = {
        ...baseScore,
        durationSec: 12,
        entities: [
          {
            id: 'hero',
            label: 'Hero',
            kind: 'character',
            position: { x: 0, y: 0.18, z: 0 },
            rotationYRad: 0,
            pitchRad: degToRad(90),
            rollRad: degToRad(170),
            height: 1.75,
            radius: 0.26,
            color: '#38bdf8',
          },
          {
            id: 'target',
            label: 'Target',
            kind: 'prop',
            position: { x: 5, y: 0, z: 4 },
            rotationYRad: 0,
            height: 1,
            radius: 0.5,
            color: '#f59e0b',
          },
        ],
        blocking: [
          // Cue 1 (0s - 4s): Wake up to upright while rolling +20 deg across +-180 boundary (170 -> -170)
          {
            id: 'wake-up',
            entityId: 'hero',
            startSec: 0,
            endSec: 4,
            position: { x: 0, y: 0, z: 0 },
            pitchRad: 0,
            rollRad: degToRad(-170),
            easing: 'linear',
          },
          // Cue 2 (4s - 8s): Fly forward while looking at target (+X); pitch=65, roll=25 must stay independent of look_at
          {
            id: 'fly-bank',
            entityId: 'hero',
            startSec: 4,
            endSec: 8,
            position: { x: 0, y: 3.5, z: 4 },
            pitchRad: degToRad(65),
            rollRad: degToRad(25),
            lookAt: 'target',
            easing: 'linear',
          },
          // Cue 3 (8s - 10s): Move without specifying pitch/roll; inherited pitch=65, roll=25 must persist under auto-facing
          {
            id: 'fly-cruise',
            entityId: 'hero',
            startSec: 8,
            endSec: 10,
            position: { x: 3, y: 3.5, z: 4 },
            easing: 'linear',
          },
          // Cue 4 (10s - 12s): Instant cut snap to prone
          {
            id: 'cut-prone',
            entityId: 'hero',
            startSec: 10,
            endSec: 12,
            position: { x: 0, y: 0.18, z: 0 },
            pitchRad: degToRad(90),
            rollRad: degToRad(-30),
            cut: true,
            easing: 'linear',
          },
        ],
      };

      const at0 = evaluateBlockingEntitiesAtTime(0, tiltBlockingScore).entitiesById.get('hero')!;
      expect(at0.pitchRad).toBeCloseTo(degToRad(90), 4);
      expect(at0.rollRad).toBeCloseTo(degToRad(170), 4);

      // Midpoint of Cue 1: pitch = 45deg, roll wraps shortest path 170 -> 180 (+10deg)
      const at2 = evaluateBlockingEntitiesAtTime(2, tiltBlockingScore).entitiesById.get('hero')!;
      expect(at2.pitchRad).toBeCloseTo(degToRad(45), 4);
      expect(at2.rollRad).toBeCloseTo(degToRad(180), 4);

      // End of Cue 2 (t = 7.9999s): pitch=65, roll=25 (mod 2*PI after -170 -> +25 wrap), lookAt faces +X
      const atFlyEnd = evaluateBlockingEntitiesAtTime(7.9999, tiltBlockingScore).entitiesById.get('hero')!;
      expect(atFlyEnd.pitchRad).toBeCloseTo(degToRad(65), 3);
      expect(shortestAngleDiff(atFlyEnd.rollRad!, degToRad(25))).toBeCloseTo(0, 3);
      expect(atFlyEnd.rotationYRad).toBeCloseTo(Math.PI / 2, 3);

      // Mid Cue 3 (t = 9s): auto-facing along +X must preserve inherited pitch=65, roll=25
      const at9 = evaluateBlockingEntitiesAtTime(9, tiltBlockingScore).entitiesById.get('hero')!;
      expect(at9.pitchRad).toBeCloseTo(degToRad(65), 4);
      expect(at9.rollRad).toBeCloseTo(degToRad(25), 4);
      expect(at9.rotationYRad).toBeCloseTo(Math.PI / 2, 4);

      // Start of Cue 4 (t = 10s): cut=true snaps pitch & roll immediately
      const at10 = evaluateBlockingEntitiesAtTime(10, tiltBlockingScore).entitiesById.get('hero')!;
      expect(at10.pitchRad).toBeCloseTo(degToRad(90), 4);
      expect(at10.rollRad).toBeCloseTo(degToRad(-30), 4);
    });

    it('evaluates legacy shots[].entities pitch & roll chaining, look_at preservation, and cut snapping', () => {
      const tiltLegacyScore: StageScore = {
        ...baseScore,
        durationSec: 6,
        entities: [
          {
            id: 'hero',
            label: 'Hero',
            kind: 'character',
            position: { x: 0, y: 0.18, z: 0 },
            rotationYRad: 0,
            pitchRad: degToRad(90),
            rollRad: 0,
            height: 1.75,
            radius: 0.26,
            color: '#38bdf8',
          },
        ],
        shots: [
          {
            id: 's1',
            shotNumber: 1,
            label: 'Wake',
            description: '',
            startSec: 0,
            endSec: 2,
            entities: {
              hero: {
                position: { x: 0, y: 0, z: 0 },
                pitchRad: 0,
                easing: 'linear',
                highlighted: false,
                visible: true,
              },
            },
          },
          {
            id: 's2',
            shotNumber: 2,
            label: 'Fly with lookAt',
            description: '',
            startSec: 2,
            endSec: 4,
            entities: {
              hero: {
                position: { x: 0, y: 3, z: 4 },
                pitchRad: degToRad(60),
                rollRad: degToRad(-20),
                lookAt: { x: 5, y: 0, z: 4 },
                easing: 'linear',
                highlighted: false,
                visible: true,
              },
            },
          },
          {
            id: 's3',
            shotNumber: 3,
            label: 'Cut pose',
            description: '',
            startSec: 4,
            endSec: 6,
            entities: {
              hero: {
                cut: true,
                pitchRad: degToRad(-90),
                rollRad: degToRad(10),
                easing: 'linear',
                highlighted: false,
                visible: true,
              },
            },
          },
        ],
      };

      const at1 = evaluateLegacyEntitiesAtTime(1, tiltLegacyScore).entitiesById.get('hero')!;
      expect(at1.pitchRad).toBeCloseTo(degToRad(45), 4);
      expect(at1.rollRad).toBeCloseTo(0, 4);

      const at3 = evaluateLegacyEntitiesAtTime(3, tiltLegacyScore).entitiesById.get('hero')!;
      expect(at3.pitchRad).toBeCloseTo(degToRad(30), 4);
      expect(at3.rollRad).toBeCloseTo(degToRad(-10), 4);
      expect(at3.rotationYRad).toBeCloseTo(Math.atan2(5, 2), 4);

      const at4 = evaluateLegacyEntitiesAtTime(4, tiltLegacyScore).entitiesById.get('hero')!;
      expect(at4.pitchRad).toBeCloseTo(degToRad(-90), 4);
      expect(at4.rollRad).toBeCloseTo(degToRad(10), 4);
    });

    it('rotates getEntityLookAnchor in 3D via YXZ while preserving bit-for-bit upright coordinates', () => {
      const def = {
        id: 'hero',
        label: 'Hero',
        kind: 'character' as const,
        position: { x: 0, y: 0, z: 0 },
        rotationYRad: 0,
        height: 1.75,
        radius: 0.26,
        color: '#38bdf8',
      };

      // Upright: 0.9 * 1.75 = 1.575m
      const upright = getEntityLookAnchor({
        id: 'hero',
        def,
        position: { x: 1, y: 0, z: -2 },
        rotationYRad: degToRad(35),
        pitchRad: 0,
        rollRad: 0,
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
      expect(upright).toEqual({ x: 1, y: 1.575, z: -2 });

      // Prone facing +Z (yaw = 0, pitch = +90deg): head extends +1.575m along +Z
      const proneZ = getEntityLookAnchor({
        id: 'hero',
        def,
        position: { x: 0, y: 0.18, z: 0 },
        rotationYRad: 0,
        pitchRad: degToRad(90),
        rollRad: 0,
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
      expect(proneZ.x).toBeCloseTo(0, 4);
      expect(proneZ.y).toBeCloseTo(0.18, 4);
      expect(proneZ.z).toBeCloseTo(1.575, 4);

      // Prone facing +X (yaw = +90deg, pitch = +90deg): head extends +1.575m along +X
      const proneX = getEntityLookAnchor({
        id: 'hero',
        def,
        position: { x: 0, y: 0.18, z: 0 },
        rotationYRad: degToRad(90),
        pitchRad: degToRad(90),
        rollRad: 0,
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
      expect(proneX.x).toBeCloseTo(1.575, 4);
      expect(proneX.y).toBeCloseTo(0.18, 4);
      expect(proneX.z).toBeCloseTo(0, 4);
    });
  });
});
