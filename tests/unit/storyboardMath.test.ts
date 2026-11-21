import { describe, expect, it } from 'vitest';
import {
  buildStoryboardSamples,
  computeShotSampleTimeSec,
  groupStoryboardSamplesByShot,
} from '../../src/core/storyboardMath';
import type { StageScore } from '../../src/core/types';
import { parseValidScore } from '../helpers/scoreFixtures';

const MULTI_SHOT_YAML = `
version: "1.0"
id: storyboard-test-scene
title: Storyboard Test Scene
duration: 12
aspect_ratio: "16:9"
entities:
  - id: hero
    label: Hero
    kind: character
    position: [0, 0, 0]
blocking:
  - id: hero-cross
    entity: hero
    start: 8
    end: 12
    from: [-2, 0, 0]
    position: [2, 0, 0]
shots:
  - id: shot-static
    label: "Shot 01 · Static Wide"
    description: "Locked establishing frame."
    start: 0
    end: 4
    stage_camera:
      maneuver: cut
      target: hero
      target_offset: [0.45, -0.1, 0]
      distance: 6
      yaw: 82
      pitch: 4
      roll: 5
      lens: 35
      dof: shallow
      aperture: 2.8
  - id: shot-dolly
    label: "Shot 02: Push In"
    description: "Slow dolly move toward hero."
    start: 4
    end: 8
    stage_camera:
      maneuver: dolly
      target: hero
      distance_start: 6
      distance_end: 2.5
      lens_start: 35
      lens_end: 85
      rig:
        type: track
        from: [0, 1.5, 6]
        to: [0, 1.5, 2.5]
  - id: shot-blocking
    label: "Shot 03 - Cross Walk"
    description: "Locked camera while hero crosses frame."
    start: 8
    end: 12
    stage_camera:
      maneuver: cut
      target: [0, 1, 0]
      distance: 5
      lens: 24
`;

describe('storyboardMath — Deterministic Shot Sampling & Grouping', () => {
  it('computes boundary-safe start, mid, and end sample times inside [startSec, endSec)', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const firstShot = score.shots[0];

    const startSec = computeShotSampleTimeSec(firstShot, 'start', score.durationSec);
    const midSec = computeShotSampleTimeSec(firstShot, 'mid', score.durationSec);
    const endSec = computeShotSampleTimeSec(firstShot, 'end', score.durationSec);

    expect(startSec).toBe(0);
    expect(midSec).toBe(2);
    expect(endSec).toBeGreaterThan(3.9);
    expect(endSec).toBeLessThan(firstShot.endSec);
  });

  it('samples 1 frame per shot in mid/start/end modes without bleeding across cut boundaries', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);

    for (const mode of ['start', 'mid', 'end'] as const) {
      const samples = buildStoryboardSamples(score, mode, 'stage-cam');
      expect(samples).toHaveLength(3);
      expect(samples.map((s) => s.frame.activeShot?.id)).toEqual([
        'shot-static',
        'shot-dolly',
        'shot-blocking',
      ]);
      expect(samples.every((s) => s.beatTag === null)).toBe(true);
    }
  });

  it('compensates for non-zero score.offsetSec when evaluating sample frames', () => {
    const offsetYaml = MULTI_SHOT_YAML.replace('duration: 12', 'duration: 12\noffset: 1.5');
    const score = parseValidScore(offsetYaml);

    const samples = buildStoryboardSamples(score, 'mid', 'stage-cam');
    expect(samples).toHaveLength(3);
    expect(samples.map((s) => s.frame.activeShot?.id)).toEqual([
      'shot-static',
      'shot-dolly',
      'shot-blocking',
    ]);
    expect(samples[0].stageTimeSec).toBe(2);
    expect(samples[0].rawTimestampSec).toBe(0.5);
    expect(samples[0].frame.timestampSec).toBe(2);
  });

  it('emits START/END pairs in start-end mode and START/MID/END triples in start-mid-end mode for moving shots', () => {
    const score = parseValidScore(MULTI_SHOT_YAML);
    const startEndSamples = buildStoryboardSamples(score, 'start-end', 'stage-cam');

    expect(startEndSamples).toHaveLength(5);
    expect(startEndSamples.map((s) => `${s.shot.id}:${s.beatTag ?? 'MID'}`)).toEqual([
      'shot-static:MID',
      'shot-dolly:START',
      'shot-dolly:END',
      'shot-blocking:START',
      'shot-blocking:END',
    ]);

    const startMidEndSamples = buildStoryboardSamples(score, 'start-mid-end', 'stage-cam');
    expect(startMidEndSamples).toHaveLength(7);
    expect(startMidEndSamples.map((s) => `${s.shot.id}:${s.beatTag ?? 'SINGLE'}`)).toEqual([
      'shot-static:SINGLE',
      'shot-dolly:START',
      'shot-dolly:MID',
      'shot-dolly:END',
      'shot-blocking:START',
      'shot-blocking:MID',
      'shot-blocking:END',
    ]);
  });

  it('returns an empty list cleanly when a score has zero shots', () => {
    const base = parseValidScore(MULTI_SHOT_YAML);
    const emptyScore: StageScore = { ...base, shots: [] };
    expect(buildStoryboardSamples(emptyScore, 'mid')).toEqual([]);
    expect(buildStoryboardSamples(emptyScore, 'start-end')).toEqual([]);
    expect(buildStoryboardSamples(emptyScore, 'start-mid-end')).toEqual([]);
    expect(groupStoryboardSamplesByShot([])).toEqual([]);
  });
});
