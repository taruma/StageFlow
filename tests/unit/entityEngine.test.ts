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
import { parseStageScore } from '../../src/core/scoreParser';
import { degToRad, rotateVec3YXZ, shortestAngleDiff } from '../../src/core/sphericalMath';

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

      // Supine facing +Z (yaw = 0, pitch = -90deg): head extends -1.575m along -Z
      const supineZ = getEntityLookAnchor({
        id: 'hero',
        def,
        position: { x: 0, y: 0.2, z: 0 },
        rotationYRad: 0,
        pitchRad: degToRad(-90),
        rollRad: 0,
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
      expect(supineZ.x).toBeCloseTo(0, 4);
      expect(supineZ.y).toBeCloseTo(0.2, 4);
      expect(supineZ.z).toBeCloseTo(-1.575, 4);

      // Pure roll = +90deg around +Z: head leans toward -X
      const rolled = getEntityLookAnchor({
        id: 'hero',
        def,
        position: { x: 1, y: 0, z: 2 },
        rotationYRad: 0,
        pitchRad: 0,
        rollRad: degToRad(90),
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
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
      const crouchedTilted = getEntityLookAnchor({
        id: 'hero',
        def,
        position: { x: -1, y: 0.5, z: 3 },
        rotationYRad: combinedYaw,
        pitchRad: combinedPitch,
        rollRad: combinedRoll,
        size: { x: 0.52, y: 1.0, z: 0.52 },
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
      expect(crouchedTilted.x).toBeCloseTo(-1 + expectedRot.x, 6);
      expect(crouchedTilted.y).toBeCloseTo(0.5 + expectedRot.y, 6);
      expect(crouchedTilted.z).toBeCloseTo(3 + expectedRot.z, 6);

      // Prop (0.5 * height) & Marker (0.5 * height) tilted anchors
      const propAnchor = getEntityLookAnchor({
        id: 'crate',
        def: { ...def, id: 'crate', kind: 'prop', height: 1.2 },
        position: { x: 2, y: 0, z: -1 },
        rotationYRad: degToRad(90),
        pitchRad: degToRad(90),
        rollRad: 0,
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
      expect(propAnchor.x).toBeCloseTo(2.6, 4);
      expect(propAnchor.y).toBeCloseTo(0, 4);
      expect(propAnchor.z).toBeCloseTo(-1, 4);

      const markerAnchor = getEntityLookAnchor({
        id: 'spike',
        def: { ...def, id: 'spike', kind: 'marker', height: 0.4 },
        position: { x: -2, y: 0, z: 1 },
        rotationYRad: 0,
        pitchRad: 0,
        rollRad: degToRad(-90),
        highlighted: false,
        visible: true,
        trailPoints: [],
      });
      expect(markerAnchor.x).toBeCloseTo(-1.8, 4);
      expect(markerAnchor.y).toBeCloseTo(0, 4);
      expect(markerAnchor.z).toBeCloseTo(1, 4);
    });

    it('chains partial single-axis pitch/roll across 3+ cues, pre-cue/gap/post holds, explicit 0, and negative +-180 wrap', () => {
      const chainScore: StageScore = {
        ...baseScore,
        durationSec: 12,
        entities: [
          {
            id: 'hero',
            label: 'Hero',
            kind: 'character',
            position: { x: 0, y: 0, z: 0 },
            rotationYRad: 0,
            pitchRad: degToRad(15),
            rollRad: degToRad(-170),
            height: 1.75,
            radius: 0.26,
            color: '#38bdf8',
          },
        ],
        blocking: [
          // Cue 1 (2..4s): pitch -> 45, roll omitted (holds -170)
          {
            id: 'c1',
            entityId: 'hero',
            startSec: 2,
            endSec: 4,
            pitchRad: degToRad(45),
            easing: 'linear',
          },
          // Gap (4..6s): holds pitch=45, roll=-170
          // Cue 2 (6..8s): roll -> +170 (negative wrap -170 -> -180 -> -190), pitch omitted (preserves 45)
          {
            id: 'c2',
            entityId: 'hero',
            startSec: 6,
            endSec: 8,
            rollRad: degToRad(170),
            easing: 'linear',
          },
          // Cue 3 (8..10s): explicit pitch=0 resets to upright, roll omitted (preserves +170)
          {
            id: 'c3',
            entityId: 'hero',
            startSec: 8,
            endSec: 10,
            pitchRad: 0,
            easing: 'linear',
          },
        ],
      };

      // Pre-cue (t = 1s): holds baseline pitch=15, roll=-170
      const atPre = evaluateBlockingEntitiesAtTime(1, chainScore).entitiesById.get('hero')!;
      expect(atPre.pitchRad).toBeCloseTo(degToRad(15), 4);
      expect(atPre.rollRad).toBeCloseTo(degToRad(-170), 4);

      // Mid Cue 1 (t = 3s): pitch=30, roll stays -170
      const atC1Mid = evaluateBlockingEntitiesAtTime(3, chainScore).entitiesById.get('hero')!;
      expect(atC1Mid.pitchRad).toBeCloseTo(degToRad(30), 4);
      expect(atC1Mid.rollRad).toBeCloseTo(degToRad(-170), 4);

      // Uncued gap (t = 5s): holds pitch=45, roll=-170
      const atGap = evaluateBlockingEntitiesAtTime(5, chainScore).entitiesById.get('hero')!;
      expect(atGap.pitchRad).toBeCloseTo(degToRad(45), 4);
      expect(atGap.rollRad).toBeCloseTo(degToRad(-170), 4);

      // Mid Cue 2 (t = 7s): pitch preserved at 45, roll wraps -170 -> -180 (-10deg step)
      const atC2Mid = evaluateBlockingEntitiesAtTime(7, chainScore).entitiesById.get('hero')!;
      expect(atC2Mid.pitchRad).toBeCloseTo(degToRad(45), 4);
      expect(atC2Mid.rollRad).toBeCloseTo(degToRad(-180), 4);

      // Mid Cue 3 (t = 9s): explicit pitch=0 interpolates 45 -> 22.5, roll preserved at +170
      const atC3Mid = evaluateBlockingEntitiesAtTime(9, chainScore).entitiesById.get('hero')!;
      expect(atC3Mid.pitchRad).toBeCloseTo(degToRad(22.5), 4);
      expect(shortestAngleDiff(atC3Mid.rollRad!, degToRad(170))).toBeCloseTo(0, 4);

      // Post-last-cue (t = 12s): holds pitch=0, roll=+170
      const atPost = evaluateBlockingEntitiesAtTime(12, chainScore).entitiesById.get('hero')!;
      expect(atPost.pitchRad).toBeCloseTo(0, 4);
      expect(shortestAngleDiff(atPost.rollRad!, degToRad(170))).toBeCloseTo(0, 4);
    });

    it('chains partial single-axis pitch/roll across 3+ legacy shots with pre/gap/post holds and negative wrap', () => {
      const legacyChainScore: StageScore = {
        ...baseScore,
        durationSec: 10,
        entities: [
          {
            id: 'hero',
            label: 'Hero',
            kind: 'character',
            position: { x: 0, y: 0, z: 0 },
            rotationYRad: 0,
            pitchRad: degToRad(20),
            rollRad: degToRad(-170),
            height: 1.75,
            radius: 0.26,
            color: '#38bdf8',
          },
        ],
        shots: [
          {
            id: 's1',
            shotNumber: 1,
            label: 'S1',
            description: '',
            startSec: 1,
            endSec: 3,
            entities: {
              hero: { pitchRad: degToRad(60), easing: 'linear', highlighted: false, visible: true },
            },
          },
          // Gap 3..4s
          {
            id: 's2',
            shotNumber: 2,
            label: 'S2',
            description: '',
            startSec: 4,
            endSec: 6,
            entities: {
              hero: { rollRad: degToRad(170), easing: 'linear', highlighted: false, visible: true },
            },
          },
          {
            id: 's3',
            shotNumber: 3,
            label: 'S3',
            description: '',
            startSec: 6,
            endSec: 8,
            entities: {
              hero: { pitchRad: 0, easing: 'linear', highlighted: false, visible: true },
            },
          },
        ],
      };

      const atPre = evaluateLegacyEntitiesAtTime(0.5, legacyChainScore).entitiesById.get('hero')!;
      expect(atPre.pitchRad).toBeCloseTo(degToRad(20), 4);
      expect(atPre.rollRad).toBeCloseTo(degToRad(-170), 4);

      const atGap = evaluateLegacyEntitiesAtTime(3.5, legacyChainScore).entitiesById.get('hero')!;
      expect(atGap.pitchRad).toBeCloseTo(degToRad(60), 4);
      expect(atGap.rollRad).toBeCloseTo(degToRad(-170), 4);

      const atS2Mid = evaluateLegacyEntitiesAtTime(5, legacyChainScore).entitiesById.get('hero')!;
      expect(atS2Mid.pitchRad).toBeCloseTo(degToRad(60), 4);
      expect(atS2Mid.rollRad).toBeCloseTo(degToRad(-180), 4);

      const atPost = evaluateLegacyEntitiesAtTime(9, legacyChainScore).entitiesById.get('hero')!;
      expect(atPost.pitchRad).toBeCloseTo(0, 4);
      expect(shortestAngleDiff(atPost.rollRad!, degToRad(170))).toBeCloseTo(0, 4);
    });

    it('produces identical pitch/roll kinematics between blocking Format A and Format B YAML', () => {
      const formatAYaml = `
version: "1.0"
id: "format-a"
title: "Format A"
duration: 6.0
entities:
  - id: "hero"
    kind: "character"
    position: [0, 0, 0]
    pitch: 90
    roll: -10
blocking:
  - id: "beat-1"
    entity: "hero"
    start: 0
    end: 4
    position: [2, 0, 0]
    pitch: 0
    roll: 25
    look_at: [5, 0, 0]
    easing: "linear"
  - id: "beat-2"
    entity: "hero"
    start: 4
    end: 6
    cut: true
    pitch: -45
    roll: 0
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 6
    stage_camera: { target: "hero" }
`;
      const formatBYaml = `
version: "1.0"
id: "format-b"
title: "Format B"
duration: 6.0
entities:
  - id: "hero"
    kind: "character"
    position: [0, 0, 0]
    pitch: 90
    roll: -10
blocking:
  - id: "beat-1"
    start: 0
    end: 4
    easing: "linear"
    entities:
      hero:
        position: [2, 0, 0]
        pitch: 0
        roll: 25
        look_at: [5, 0, 0]
  - id: "beat-2"
    start: 4
    end: 6
    cut: true
    entities:
      hero:
        pitch: -45
        roll: 0
shots:
  - id: "s1"
    shot: 1
    start: 0
    end: 6
    stage_camera: { target: "hero" }
`;
      const parsedA = parseStageScore(formatAYaml);
      const parsedB = parseStageScore(formatBYaml);
      expect(parsedA.error).toBeNull();
      expect(parsedB.error).toBeNull();

      for (const t of [0, 2, 3.99, 4, 5]) {
        const heroA = evaluateEntitiesAtTime(t, parsedA.score!).entitiesById.get('hero')!;
        const heroB = evaluateEntitiesAtTime(t, parsedB.score!).entitiesById.get('hero')!;
        expect(heroB.position).toEqual(heroA.position);
        expect(heroB.rotationYRad).toBeCloseTo(heroA.rotationYRad, 6);
        expect(heroB.pitchRad).toBeCloseTo(heroA.pitchRad!, 6);
        expect(heroB.rollRad).toBeCloseTo(heroA.rollRad!, 6);
      }
    });

    it('resolves dot-notation sub-anchors in resolveLookAtPoint and blocking/legacy look_at (#19)', () => {
      const currentPositions = new Map([
        ['hero', { x: 0, y: 0, z: 0 }],
      ]);
      const currentPoses = new Map([
        ['hero', { rotationYRad: 0, pitchRad: degToRad(90), rollRad: 0, size: { x: 1.0, y: 2.0, z: 0.5 } }],
      ]);
      const entities = [
        {
          id: 'hero',
          label: 'Hero',
          kind: 'character' as const,
          position: { x: 0, y: 0, z: 0 },
          rotationYRad: 0,
          width: 1.0,
          height: 2.0,
          radius: 0.5,
          color: '#38bdf8',
        },
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
      const leftShoulder = resolveLookAtPoint('hero.shoulder_l', currentPositions, entities, uprightPoses)!;
      expect(leftShoulder.x).toBeCloseTo(0.4, 4);
      expect(leftShoulder.y).toBeCloseTo(1.54, 4);
      expect(leftShoulder.z).toBeCloseTo(0, 4);

      const rightShoulder = resolveLookAtPoint('hero.shoulder_r', currentPositions, entities, uprightPoses)!;
      expect(rightShoulder.x).toBeCloseTo(-0.4, 4);

      // End-to-end blocking look_at toward prone hero.head vs hero.feet
      const blockingYaml = `
version: "1.0"
id: "look-at-sub-anchor"
title: "Look-At Sub-Anchor"
duration: 4.0
entities:
  - id: "prone_hero"
    kind: "character"
    position: [0, 0.18, 0]
    height: 2.0
    rotation: 0
    pitch: 90
  - id: "medic"
    kind: "character"
    position: [3, 0, 0]
blocking:
  - id: "look-at-head"
    entity: "medic"
    start: 0
    end: 4
    look_at: "prone_hero.head"
shots:
  - id: "s1"
    start: 0
    end: 4
    stage_camera: { target: "prone_hero.chest" }
`;
      const parsed = parseStageScore(blockingYaml);
      expect(parsed.error).toBeNull();
      const medic = evaluateEntitiesAtTime(2.0, parsed.score!).entitiesById.get('medic')!;
      // Medic at [3, 0, 0] looking at prone_hero.head [0, 0.18, 1.8] -> dx = -3, dz = +1.8
      const expectedYaw = Math.atan2(-3, 1.8);
      expect(medic.rotationYRad).toBeCloseTo(expectedYaw, 4);

      // Upright "hero.typo" must match bare "hero" identically in resolveLookAtPoint
      const barePt = resolveLookAtPoint('hero', currentPositions, entities, uprightPoses);
      const typoPt = resolveLookAtPoint('hero.typo', currentPositions, entities, uprightPoses);
      expect(typoPt).toEqual(barePt);
    });

    it('resolves Tier 2 legacy shots[].entities.<id>.look_at with dot-notation sub-anchors (#19)', () => {
      const legacyYaml = `
version: "1.0"
id: "legacy-look-at-sub-anchor"
title: "Legacy Look-At Sub-Anchor"
duration: 4.0
entities:
  - id: "prone_hero"
    kind: "character"
    position: [0, 0.18, 0]
    width: 0.6
    height: 2.0
    rotation: 0
    pitch: 90
  - id: "medic"
    kind: "character"
    position: [3, 0, 0]
    rotation: 0
shots:
  - id: "s1"
    start: 0
    end: 4
    entities:
      medic:
        look_at: "prone_hero.head"
`;
      const parsed = parseStageScore(legacyYaml);
      expect(parsed.error).toBeNull();
      // Medic at [3, 0, 0] looking at prone_hero.head [0, 0.18, 1.8] -> dx = -3, dz = +1.8
      const expectedYaw = Math.atan2(-3, 1.8);
      for (const t of [0.0, 2.0, 3.999, 4.0]) {
        const medic = evaluateEntitiesAtTime(t, parsed.score!).entitiesById.get('medic')!;
        expect(medic.rotationYRad).toBeCloseTo(expectedYaw, 4);
      }
    });

    it('evaluates mutual and chained sub-anchor look_at identically regardless of entity order in blocking and legacy (#19)', () => {
      const buildScoreYaml = (reverseEntities: boolean, mode: 'blocking' | 'legacy') => {
        const entA = `
  - id: "alice"
    kind: "character"
    position: [0, 0, 0]
    width: 1.0
    height: 1.8
    rotation: 0`;
        const entB = `
  - id: "bob"
    kind: "character"
    position: [3, 0, 1]
    width: 1.0
    height: 1.8
    rotation: 0`;
        const entitiesBlock = reverseEntities ? `${entB}\n${entA}` : `${entA}\n${entB}`;
        if (mode === 'blocking') {
          return `
version: "1.0"
id: "mutual-blocking-${reverseEntities}"
title: "Mutual Blocking"
duration: 4.0
entities:${entitiesBlock}
blocking:
  - id: "c-alice"
    entity: "alice"
    start: 0
    end: 4
    look_at: "bob.shoulder_l"
  - id: "c-bob"
    entity: "bob"
    start: 0
    end: 4
    look_at: "alice.shoulder_l"
shots:
  - id: "s1"
    start: 0
    end: 4
`;
        }
        return `
version: "1.0"
id: "mutual-legacy-${reverseEntities}"
title: "Mutual Legacy"
duration: 4.0
entities:${entitiesBlock}
shots:
  - id: "s1"
    start: 0
    end: 4
    entities:
      alice:
        look_at: "bob.shoulder_l"
      bob:
        look_at: "alice.shoulder_l"
`;
      };

      for (const mode of ['blocking', 'legacy'] as const) {
        const scoreFwd = parseStageScore(buildScoreYaml(false, mode)).score!;
        const scoreRev = parseStageScore(buildScoreYaml(true, mode)).score!;

        for (const t of [0.5, 2.0, 3.999, 4.0]) {
          const fwd = evaluateEntitiesAtTime(t, scoreFwd).entitiesById;
          const rev = evaluateEntitiesAtTime(t, scoreRev).entitiesById;

          const aliceFwd = fwd.get('alice')!;
          const bobFwd = fwd.get('bob')!;
          const aliceRev = rev.get('alice')!;
          const bobRev = rev.get('bob')!;

          expect(aliceFwd.rotationYRad).toBeCloseTo(aliceRev.rotationYRad, 6);
          expect(bobFwd.rotationYRad).toBeCloseTo(bobRev.rotationYRad, 6);

          // Verify mutual fixed-point convergence: Alice faces Bob's rotated shoulder_l
          const bobShoulderL = {
            x: bobFwd.position.x + 0.4 * Math.cos(bobFwd.rotationYRad),
            y: 0.77 * 1.8,
            z: bobFwd.position.z - 0.4 * Math.sin(bobFwd.rotationYRad),
          };
          expect(aliceFwd.rotationYRad).toBeCloseTo(
            Math.atan2(bobShoulderL.x - aliceFwd.position.x, bobShoulderL.z - aliceFwd.position.z),
            5
          );
        }
      }

      // Chained look_at: A -> B.shoulder_l while B -> center (must be order-independent in both modes)
      const buildChainedYaml = (reverseEntities: boolean, mode: 'blocking' | 'legacy') => {
        const entA = `
  - id: "a"
    kind: "character"
    position: [-2, 0, 2]
    width: 1.0
    height: 1.8
    rotation: 0`;
        const entB = `
  - id: "b"
    kind: "character"
    position: [2, 0, 2]
    width: 1.0
    height: 1.8
    rotation: 0`;
        const entitiesBlock = reverseEntities ? `${entB}\n${entA}` : `${entA}\n${entB}`;
        if (mode === 'blocking') {
          return `
version: "1.0"
id: "chain-blocking-${reverseEntities}"
title: "Chained Blocking"
duration: 4.0
entities:${entitiesBlock}
blocking:
  - id: "ca"
    entity: "a"
    start: 0
    end: 4
    look_at: "b.shoulder_l"
  - id: "cb"
    entity: "b"
    start: 0
    end: 4
    look_at: "center"
shots:
  - id: "s1"
    start: 0
    end: 4
`;
        }
        return `
version: "1.0"
id: "chain-legacy-${reverseEntities}"
title: "Chained Legacy"
duration: 4.0
entities:${entitiesBlock}
shots:
  - id: "s1"
    start: 0
    end: 4
    entities:
      a:
        look_at: "b.shoulder_l"
      b:
        look_at: "center"
`;
      };

      for (const mode of ['blocking', 'legacy'] as const) {
        const scoreFwd = parseStageScore(buildChainedYaml(false, mode)).score!;
        const scoreRev = parseStageScore(buildChainedYaml(true, mode)).score!;
        for (const t of [1.0, 3.999, 4.0]) {
          const fwd = evaluateEntitiesAtTime(t, scoreFwd).entitiesById;
          const rev = evaluateEntitiesAtTime(t, scoreRev).entitiesById;
          expect(fwd.get('a')!.rotationYRad).toBeCloseTo(rev.get('a')!.rotationYRad, 6);
          expect(fwd.get('b')!.rotationYRad).toBeCloseTo(rev.get('b')!.rotationYRad, 6);

          // B faces center (0,0,0) from [2,0,2] -> yaw = atan2(-2, -2) = -3*PI/4
          const bYaw = fwd.get('b')!.rotationYRad;
          expect(bYaw).toBeCloseTo(Math.atan2(-2, -2), 5);
          // A looks at B's shoulder_l rotated by bYaw
          const bShoulderL = {
            x: 2 + 0.4 * Math.cos(bYaw),
            z: 2 - 0.4 * Math.sin(bYaw),
          };
          expect(fwd.get('a')!.rotationYRad).toBeCloseTo(
            Math.atan2(bShoulderL.x - -2, bShoulderL.z - 2),
            5
          );
        }
      }
    });
  });
});
