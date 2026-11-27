import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseStageScore } from '../../src/core/scoreParser';
import {
  applyScoreYamlCommand,
  applyScoreYamlCommandDetailed,
} from '../../src/core/scoreYamlMutator';

const SAMPLE_YAML = `# ==============================================================================
# TEST SCORE BANNER
# ==============================================================================
version: "1.0"
id: "mutator-test"
title: "Mutator Test"
duration: 12.0

entities:
  - id: "hero"
    label: "Hero"
    kind: "character"
    position: [0, 0, 0] # Inline floor comment
    rotation: 0
    color: "#38bdf8"

shots:
  - id: "shot-1"
    shot: 1
    label: "Opening"
    start: 0.0
    end: 4.0
    stage_camera:
      target: "hero"
      maneuver: "dolly"
      distance: 4.5
      pitch: 10
      yaw: 0
      lens: "50mm" # Normal lens
  - id: "shot-2"
    shot: 2
    label: "Close"
    start: 4.0
    end: 8.0
    stage_camera:
      target: "hero"
      maneuver: "cut"
      distance: 1.8
      lens: "85mm"
  - id: "shot-3"
    shot: 3
    label: "Wide"
    start: 8.0
    end: 12.0
    stage_camera:
      target: "hero"
      maneuver: "arc"
      distance: 6.0
      lens: "35mm"
`;

describe('scoreYamlMutator', () => {
  it('preserves section banners and inline comments across set/add/remove field commands', () => {
    let next = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'set-field',
      path: ['shots', 0, 'stage_camera', 'distance'],
      value: 3.25,
    });
    expect(next).toContain('# TEST SCORE BANNER');
    expect(next).toContain('# Inline floor comment');
    expect(next).toContain('# Normal lens');

    next = applyScoreYamlCommand(next, {
      type: 'set-field',
      path: ['shots', 0, 'stage_camera', 'lens'],
      value: 35,
      format: 'lens-mm',
    });
    expect(next).toContain('lens: "35mm"');

    next = applyScoreYamlCommand(next, {
      type: 'add-field',
      parentPath: ['shots', 0, 'stage_camera'],
      key: 'dof',
      value: 'shallow',
    });
    expect(parseStageScore(next).score?.shots[0].stageCamera?.dof).toBe('shallow');

    next = applyScoreYamlCommand(next, {
      type: 'remove-field',
      path: ['shots', 0, 'stage_camera', 'dof'],
    });
    expect(parseStageScore(next).score?.shots[0].stageCamera?.dof).toBeUndefined();
  });

  it('splits previous shot on insert-shot-split while keeping downstream shots intact', () => {
    const next = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'insert-shot-split',
      afterIndex: 0,
    });
    const parsed = parseStageScore(next);
    expect(parsed.error).toBeNull();
    expect(parsed.score?.shots).toHaveLength(4);
    expect(parsed.score?.shots[0].startSec).toBe(0);
    expect(parsed.score?.shots[0].endSec).toBe(2);
    expect(parsed.score?.shots[1].startSec).toBe(2);
    expect(parsed.score?.shots[1].endSec).toBe(4);
    expect(parsed.score?.shots[2].startSec).toBe(4);
    expect(parsed.score?.shots[2].endSec).toBe(8);
    expect(parsed.score?.shots[3].startSec).toBe(8);
    expect(parsed.score?.shots[3].endSec).toBe(12);
    expect(parsed.score?.shots.map((s) => s.shotNumber)).toEqual([1, 2, 3, 4]);
  });

  it('supports free, roll, and ripple timing adjustments', () => {
    // Roll: extending shot 0 end to 5.0 pulls shot 1 start to 5.0
    const rolled = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'adjust-shot-timing',
      shotIndex: 0,
      edge: 'end',
      nextValueSec: 5.0,
      mode: 'roll',
    });
    const parsedRoll = parseStageScore(rolled).score!;
    expect(parsedRoll.shots[0].endSec).toBe(5.0);
    expect(parsedRoll.shots[1].startSec).toBe(5.0);
    expect(parsedRoll.shots[1].endSec).toBe(8.0);

    // Ripple: extending shot 0 end to 6.0 (+2s) shifts shots 1 & 2 and duration by +2s
    const rippled = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'adjust-shot-timing',
      shotIndex: 0,
      edge: 'end',
      nextValueSec: 6.0,
      mode: 'ripple',
    });
    const parsedRipple = parseStageScore(rippled).score!;
    expect(parsedRipple.shots[0].endSec).toBe(6.0);
    expect(parsedRipple.shots[1].startSec).toBe(6.0);
    expect(parsedRipple.shots[1].endSec).toBe(10.0);
    expect(parsedRipple.shots[2].startSec).toBe(10.0);
    expect(parsedRipple.shots[2].endSec).toBe(14.0);
    expect(parsedRipple.durationSec).toBe(14.0);
  });

  it('keeps vec3 sequences in compact flow syntax [x, y, z]', () => {
    const next = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'set-field',
      path: ['entities', 0, 'position'],
      value: [1.5, 0, -2.25],
      format: 'vec3-flow',
    });
    expect(next).toMatch(/\[\s*1\.5,\s*0,\s*-2\.25\s*\]/);
    expect(parseStageScore(next).score?.entities[0].position).toEqual({
      x: 1.5,
      y: 0,
      z: -2.25,
    });
  });

  it('mutates all 7 bundled blueprints cleanly without parse errors', () => {
    const bpDir = path.resolve(__dirname, '../../src/scores/blueprints');
    const files = fs.readdirSync(bpDir).filter((f) => f.endsWith('.yaml'));
    expect(files.length).toBe(7);

    for (const file of files) {
      const yaml = fs.readFileSync(path.join(bpDir, file), 'utf8');
      const updated = applyScoreYamlCommand(yaml, {
        type: 'set-field',
        path: ['title'],
        value: `Modified ${file}`,
      });
      const parsed = parseStageScore(updated, file);
      expect(parsed.error).toBeNull();
      expect(parsed.score?.title).toBe(`Modified ${file}`);
    }
  });

  it('returns changed status and reusable Document AST from applyScoreYamlCommandDetailed', () => {
    const res = applyScoreYamlCommandDetailed(SAMPLE_YAML, {
      type: 'set-field',
      path: ['shots', 0, 'stage_camera', 'distance'],
      value: 5.5,
    });
    expect(res.changed).toBe(true);
    expect(res.doc).not.toBeNull();
    expect(res.nextYaml).toContain('# Inline floor comment');
    expect(res.nextYaml).toMatch(/position:\s*\[\s*0,\s*0,\s*0\s*\]/);

    const noop = applyScoreYamlCommandDetailed(res.nextYaml, {
      type: 'set-field',
      path: ['shots', 0, 'stage_camera', 'distance'],
      value: 5.5,
    });
    expect(noop.changed).toBe(false);
  });
});
