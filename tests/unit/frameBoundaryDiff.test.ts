import { describe, expect, it } from 'vitest';
import { computeStageFrame } from '../../src/core/frameEngine';
import { hasStageFrameBoundaryChanged } from '../../src/core/frameBoundaryDiff';
import type { StageFrame } from '../../src/core/types';
import { makeScore } from '../helpers/scoreFixtures';

describe('frameBoundaryDiff', () => {
  const score = makeScore({
    durationSec: 8,
    shots: [
      {
        id: 'shot-1',
        shotNumber: 1,
        label: 'Shot 1',
        description: 'Opening dolly',
        startSec: 0,
        endSec: 4,
        entities: {
          actor: {
            position: { x: 2, y: 0, z: 0 },
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
        description: 'Cut to reverse',
        startSec: 4,
        endSec: 8,
        entities: {
          actor: {
            position: { x: 4, y: 0, z: 0 },
            easing: 'linear',
            highlighted: true,
            visible: true,
          },
        },
      },
    ],
  });

  it('returns false for two frames within the same shot and cue without structural changes', () => {
    const frameA = computeStageFrame(0.1, score);
    const frameB = computeStageFrame(0.2, score);
    expect(hasStageFrameBoundaryChanged(frameA, frameB)).toBe(false);
  });

  it('returns true when stageCamera.shotId changes across a shot cut', () => {
    const frameA = computeStageFrame(0.1, score);
    const secondShot = score.shots[1];
    expect(secondShot).toBeDefined();
    const frameB = computeStageFrame(secondShot.startSec + 0.05, score);
    expect(hasStageFrameBoundaryChanged(frameA, frameB)).toBe(true);
  });

  it('returns true when entity cueId, highlighted, visible, or trailPoints change', () => {
    const base = computeStageFrame(0.1, score);
    const cloneWithEntityPatch = (
      patch: Partial<StageFrame['entitiesList'][number]>
    ): StageFrame => ({
      ...base,
      entitiesList: base.entitiesList.map((e, idx) => (idx === 0 ? { ...e, ...patch } : e)),
    });

    expect(hasStageFrameBoundaryChanged(base, cloneWithEntityPatch({ cueId: 'modified-cue' }))).toBe(
      true
    );
    expect(
      hasStageFrameBoundaryChanged(
        base,
        cloneWithEntityPatch({ highlighted: !base.entitiesList[0].highlighted })
      )
    ).toBe(true);
    expect(
      hasStageFrameBoundaryChanged(
        base,
        cloneWithEntityPatch({ visible: !base.entitiesList[0].visible })
      )
    ).toBe(true);
    expect(
      hasStageFrameBoundaryChanged(
        base,
        cloneWithEntityPatch({
          trailPoints: base.entitiesList[0].trailPoints.map((p) => ({ ...p })),
        })
      )
    ).toBe(false);
    expect(
      hasStageFrameBoundaryChanged(
        base,
        cloneWithEntityPatch({
          trailPoints: [...base.entitiesList[0].trailPoints, { x: 99, y: 0.02, z: 99 }],
        })
      )
    ).toBe(true);
  });
});
