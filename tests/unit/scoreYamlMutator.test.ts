import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseStageScore } from '../../src/core/scoreParser';
import {
  applyScoreYamlCommand,
  applyScoreYamlCommandDetailed,
} from '../../src/core/scoreYamlMutator';
import { projectVisualScoreIRFromDoc } from '../../src/core/scoreYamlProjection';

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

  it('reorders YAML map keys in-place at root and nested stage_camera levels while preserving comments', () => {
    const afterRoot = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'reorder-map-key',
      parentPath: [],
      fromKey: 'duration',
      toKey: 'version',
    });
    const versionIdx = afterRoot.indexOf('version:');
    const durationIdx = afterRoot.indexOf('duration:');
    expect(durationIdx).toBeGreaterThan(-1);
    expect(durationIdx).toBeLessThan(versionIdx);
    expect(afterRoot).toContain('# TEST SCORE BANNER');

    const afterNested = applyScoreYamlCommand(afterRoot, {
      type: 'reorder-map-key',
      parentPath: ['shots', 0, 'stage_camera'],
      fromKey: 'lens',
      toKey: 'maneuver',
    });
    const shotSection = afterNested.split('- id: "shot-1"')[1].split('- id: "shot-2"')[0];
    expect(shotSection.indexOf('lens:')).toBeLessThan(shotSection.indexOf('maneuver:'));
    expect(afterNested).toContain('# Normal lens');
  });

  it('inserts added scalar fields before structural blocks instead of the bottom of YAML', () => {
    const withDesc = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'add-field',
      parentPath: [],
      key: 'description',
      value: 'Studio staging note',
    });
    expect(withDesc.indexOf('description:')).toBeLessThan(
      withDesc.indexOf('entities:')
    );

    const vfPath = path.resolve(
      __dirname,
      '../../src/scores/studies/vector_field.yaml'
    );
    const vfYaml = fs.readFileSync(vfPath, 'utf8');
    const vfWithDesc = applyScoreYamlCommand(vfYaml, {
      type: 'add-field',
      parentPath: [],
      key: 'description',
      value: 'Cornfield confrontation',
    });
    expect(vfWithDesc.indexOf('description:')).toBeLessThan(
      vfWithDesc.indexOf('optics:')
    );
    expect(parseStageScore(vfWithDesc, 'vf').error).toBeNull();

    const shotWithFocus = applyScoreYamlCommand(withDesc, {
      type: 'add-field',
      parentPath: ['shots', 0],
      key: 'focus',
      value: 'hero',
    });
    const shotSlice = shotWithFocus
      .split('- id: "shot-1"')[1]
      .split('- id: "shot-2"')[0];
    expect(shotSlice.indexOf('focus:')).toBeLessThan(
      shotSlice.indexOf('stage_camera:')
    );
  });

  it('inserts optics: and metadata: blocks before stage:/entities:, heals bare null blocks, and deletes cleanly', () => {
    const withOptics = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'add-field',
      parentPath: ['optics'],
      key: 'dof',
      value: 'medium',
    });
    expect(withOptics.indexOf('optics:')).toBeLessThan(
      withOptics.indexOf('entities:')
    );
    expect(parseStageScore(withOptics).score?.optics?.defaultDof).toBe('medium');

    const withMeta = applyScoreYamlCommand(withOptics, {
      type: 'add-field',
      parentPath: ['metadata'],
      key: 'director',
      value: 'Taruma',
    });
    expect(withMeta.indexOf('metadata:')).toBeLessThan(
      withMeta.indexOf('optics:')
    );

    const bareNullOptics = `${SAMPLE_YAML.replace('entities:', 'optics:\nentities:')}`;
    const healed = applyScoreYamlCommand(bareNullOptics, {
      type: 'add-field',
      parentPath: ['optics'],
      key: 'dof',
      value: 'shallow',
    });
    expect(parseStageScore(healed).score?.optics?.defaultDof).toBe('shallow');

    const removedOptics = applyScoreYamlCommand(withOptics, {
      type: 'remove-field',
      path: ['optics'],
    });
    expect(removedOptics).not.toContain('optics:');
    expect(parseStageScore(removedOptics).score?.optics).toBeUndefined();
  });

  it('supports append-seq-item block lists, list item deletion, and YAML literal block formatting for multiline strings', () => {
    let next = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'add-field',
      parentPath: ['metadata'],
      key: 'production_notes',
      value: ['First note'],
      format: 'plain',
    });
    next = applyScoreYamlCommand(next, {
      type: 'append-seq-item',
      path: ['metadata', 'production_notes'],
      value: 'Second note',
    });
    expect(next).toContain('- First note');
    expect(next).toContain('- Second note');

    next = applyScoreYamlCommand(next, {
      type: 'remove-field',
      path: ['metadata', 'production_notes', 0],
    });
    expect(next).not.toContain('First note');
    expect(next).toContain('- Second note');

    let multi = applyScoreYamlCommand(SAMPLE_YAML, {
      type: 'add-field',
      parentPath: [],
      key: 'description',
      value: 'Line 1\nLine 2',
    });
    expect(multi).toContain('description: |');
    expect(parseStageScore(multi).error).toBeNull();

    multi = applyScoreYamlCommand(multi, {
      type: 'set-field',
      path: ['description'],
      value: 'Single line summary',
    });
    expect(multi).not.toContain('description: |');
    expect(multi).toContain('Single line summary');
  });

  it('produces identical YAML output when reusing a cached existingDoc AST across sequential edits', () => {
    const step1Cached = applyScoreYamlCommandDetailed(SAMPLE_YAML, {
      type: 'set-field',
      path: ['continuous'],
      value: true,
    });
    const step2Cached = applyScoreYamlCommandDetailed(
      step1Cached.nextYaml,
      {
        type: 'set-field',
        path: ['shots', 0, 'stage_camera', 'distance'],
        value: 5.5,
      },
      step1Cached.doc ?? undefined
    );
    const step2Fresh = applyScoreYamlCommand(step1Cached.nextYaml, {
      type: 'set-field',
      path: ['shots', 0, 'stage_camera', 'distance'],
      value: 5.5,
    });
    expect(step2Cached.nextYaml).toBe(step2Fresh);
    expect(step2Cached.nextYaml).toContain('# Normal lens');
  });

  it('keeps every added metadata, optics, entity, blocking, and shot key visible via immediate live-AST projectVisualScoreIRFromDoc', () => {
    let res = applyScoreYamlCommandDetailed(SAMPLE_YAML, {
      type: 'add-field',
      parentPath: ['metadata'],
      key: 'director',
      value: 'Taruma',
      format: 'plain',
    });
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'add-field', parentPath: ['metadata'], key: 'music', value: 'Theme', format: 'plain' },
      res.doc ?? undefined
    );
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'add-field', parentPath: ['metadata'], key: 'camera_package', value: { body: 'Alexa' }, format: 'plain' },
      res.doc ?? undefined
    );
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'add-field', parentPath: ['metadata'], key: 'production_notes', value: ['Wide'], format: 'plain' },
      res.doc ?? undefined
    );
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'add-field', parentPath: ['optics'], key: 'dof', value: 'medium' },
      res.doc ?? undefined
    );
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'insert-entity', afterIndex: 0 },
      res.doc ?? undefined
    );
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'insert-blocking', afterIndex: -1 },
      res.doc ?? undefined
    );
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'insert-shot-split', afterIndex: 0 },
      res.doc ?? undefined
    );
    res = applyScoreYamlCommandDetailed(
      res.nextYaml,
      { type: 'reorder-map-key', parentPath: ['metadata'], fromKey: 'music', toKey: 'director' },
      res.doc ?? undefined
    );

    const parsed = parseStageScore(res.nextYaml, 'live-ast');
    const liveIr = projectVisualScoreIRFromDoc(res.doc!, parsed.score).ir!;

    expect(liveIr.metadata.entries.map((e) => e.key)).toEqual([
      'music',
      'director',
      'camera_package',
      'production_notes',
    ]);
    expect(liveIr.optics.fields.map((f) => f.key)).toEqual(['dof']);
    expect(liveIr.entities).toHaveLength(2);
    expect(liveIr.entities[1].fields.map((f) => f.key)).toContain('label');
    expect(liveIr.blocking).toHaveLength(1);
    expect(liveIr.blocking[0].fields.map((f) => f.key)).toContain('entity');
    expect(liveIr.shots).toHaveLength(4);
    expect(liveIr.shots[1].stageCamera?.fields.map((f) => f.key)).toContain('lens');
  });
});
