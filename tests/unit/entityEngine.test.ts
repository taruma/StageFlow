import { describe, expect, it } from 'vitest';
import type { StageScore } from '../../src/core/types';
import {
  evaluateBlockingEntitiesAtTime,
  evaluateEntitiesAtTime,
  evaluateLegacyEntitiesAtTime,
} from '../../src/core/entityEngine';
import { makeScore } from '../helpers/scoreFixtures';

describe('Entity Engine Facade & Dispatching (entityEngine)', () => {
  const baseScore = makeScore();

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
});
