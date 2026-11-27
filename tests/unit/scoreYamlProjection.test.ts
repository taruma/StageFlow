import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocument } from 'yaml';
import {
  normalizeParsedStageScore,
  parseStageScore,
} from '../../src/core/scoreParser';
import {
  projectVisualScoreIR,
  projectVisualScoreIRFromDoc,
  stabilizeVisualScoreIR,
} from '../../src/core/scoreYamlProjection';

const SCORES_ROOT = path.resolve(__dirname, '../../src/scores');

function readScoreFile(relPath: string): string {
  return fs.readFileSync(path.join(SCORES_ROOT, relPath), 'utf8');
}

describe('scoreYamlProjection', () => {
  it('projects coupled shots[].observer_camera and shots[].entities in BP01', () => {
    const yaml = readScoreFile('blueprints/demo_blueprint.yaml');
    const parsed = parseStageScore(yaml, 'demo-blueprint');
    expect(parsed.score).not.toBeNull();

    const res = projectVisualScoreIR(yaml, parsed.score);
    expect(res.error).toBeNull();
    const ir = res.ir!;
    expect(ir.entities).toHaveLength(2);
    expect(ir.shots).toHaveLength(1);
    expect(ir.shots[0].stageCamera?.key).toBe('stage_camera');
    expect(ir.shots[0].observerCamera?.key).toBe('observer_camera');
    expect(ir.shots[0].entityOverrides.map((e) => e.name)).toEqual([
      'protagonist',
      'interlocutor',
    ]);
    expect(ir.shots[0].lineRange).toBeDefined();
  });

  it('projects decoupled observer_shots in BP02 and blocking in BP07', () => {
    const bp02 = readScoreFile('blueprints/blueprint_02_dialogue.yaml');
    const parsed02 = parseStageScore(bp02, 'bp02');
    const ir02 = projectVisualScoreIR(bp02, parsed02.score).ir!;
    expect(ir02.shots).toHaveLength(6);
    expect(ir02.observerShots.length).toBeGreaterThanOrEqual(3);

    const bp07 = readScoreFile('blueprints/blueprint_07_camera_rigs.yaml');
    const parsed07 = parseStageScore(bp07, 'bp07');
    const ir07 = projectVisualScoreIR(bp07, parsed07.score).ir!;
    expect(ir07.blocking).toHaveLength(2);
    expect(ir07.blocking[0].entityId).toBe('protagonist');
    expect(ir07.shots[0].stageCamera?.rig).toBeDefined();
    expect(ir07.shots[0].stageCamera?.rig?.fields.some((f) => f.canonicalKey === 'type')).toBe(true);
  });

  it('projects flat shot-level optics fields (BP06 Shot 07) and multi-waypoint splines', () => {
    const bp06 = readScoreFile('blueprints/blueprint_06_optics_dof.yaml');
    const parsed06 = parseStageScore(bp06, 'bp06');
    const ir06 = projectVisualScoreIR(bp06, parsed06.score).ir!;
    expect(ir06.optics.exists).toBe(true);
    expect(ir06.optics.fields.some((f) => f.canonicalKey === 'dof_blur')).toBe(true);

    // Shot 06 has spline waypoints
    const shot06 = ir06.shots[5];
    expect(shot06.stageCamera?.waypoints.length).toBeGreaterThan(0);

    // Shot 07 uses flat focus/dof at shot root
    const shot07 = ir06.shots[6];
    expect(shot07.fields.some((f) => f.canonicalKey === 'focus')).toBe(true);
    expect(shot07.fields.some((f) => f.canonicalKey === 'dof')).toBe(true);
  });

  it('projects multi-entity blocking cues in Vector Field', () => {
    const vf = readScoreFile('studies/vector_field.yaml');
    const parsedVf = parseStageScore(vf, 'vector-field');
    const irVf = projectVisualScoreIR(vf, parsedVf.score).ir!;
    expect(irVf.entities.length).toBeGreaterThan(0);
    expect(irVf.blocking.length).toBeGreaterThan(0);
    expect(irVf.blocking[0].entityOverrides.length).toBeGreaterThan(0);
    expect(irVf.shots.length).toBeGreaterThan(10);
  });

  it('preserves unregistered custom keys with null descriptor instead of dropping them', () => {
    const yaml = `
version: "1.0"
id: "custom-ext"
title: "Custom"
shots:
  - id: "s1"
    start: 0
    end: 4
    stage_camera:
      target: [0, 1, 0]
      shutter_angle: 180
`;
    const parsed = parseStageScore(yaml, 'custom-ext');
    const ir = projectVisualScoreIR(yaml, parsed.score).ir!;
    const extra = ir.shots[0].stageCamera?.fields.find(
      (f) => f.key === 'shutter_angle'
    );
    expect(extra).toBeDefined();
    expect(extra?.descriptor).toBeNull();
    expect(extra?.value).toBe(180);
  });

  it('produces matching IR from projectVisualScoreIRFromDoc and normalizeParsedStageScore without re-parsing text', () => {
    const bp06 = readScoreFile('blueprints/blueprint_06_optics_dof.yaml');
    const doc = parseDocument(bp06);
    const normalized = normalizeParsedStageScore(doc.toJS(), 'bp06');
    expect(normalized.error).toBeNull();

    const fullIr = projectVisualScoreIR(bp06, normalized.score).ir!;
    const fromDocIr = projectVisualScoreIRFromDoc(doc, normalized.score).ir!;

    expect(fromDocIr.shots).toHaveLength(fullIr.shots.length);
    expect(fromDocIr.shots.map((s) => s.id)).toEqual(
      fullIr.shots.map((s) => s.id)
    );
    expect(fromDocIr.entities.length).toBe(fullIr.entities.length);
    expect(fromDocIr.optics.fields.map((f) => f.key)).toEqual(
      fullIr.optics.fields.map((f) => f.key)
    );
  });

  it('projects freeform metadata scalars, nested maps, and lists in BP01 and Three Years Late', () => {
    const bp01 = readScoreFile('blueprints/demo_blueprint.yaml');
    const parsed01 = parseStageScore(bp01, 'demo-blueprint');
    const ir01 = projectVisualScoreIR(bp01, parsed01.score).ir!;

    expect(ir01.metadata.exists).toBe(true);
    expect(ir01.metadata.entries.map((e) => [e.key, e.kind])).toEqual([
      ['music', 'scalar'],
      ['camera_package', 'map'],
      ['production_notes', 'list'],
    ]);
    const pkg = ir01.metadata.entries[1];
    expect(pkg.kind === 'map' && pkg.entries.map((c) => c.key)).toEqual([
      'body',
      'stabilizer',
    ]);
    const notes = ir01.metadata.entries[2];
    expect(notes.kind === 'list' && notes.items).toHaveLength(2);

    const tyl = readScoreFile('studies/three-years-late.yaml');
    const parsedTyl = parseStageScore(tyl, 'three-years-late');
    const irTyl = projectVisualScoreIR(tyl, parsedTyl.score).ir!;
    expect(irTyl.metadata.exists).toBe(true);
    expect(
      irTyl.metadata.entries.some((e) => e.key === 'directorial_notes' && e.kind === 'list')
    ).toBe(true);
    const descField = irTyl.rootFields.find((f) => f.canonicalKey === 'description');
    expect(descField?.descriptor?.multiline).toBe(true);
    expect(String(descField?.value)).toContain('\n');
  });

  it('reuses exact untouched section and card references via stabilizeVisualScoreIR', () => {
    const bp06 = readScoreFile('blueprints/blueprint_06_optics_dof.yaml');
    const scoreA = parseStageScore(bp06, 'bp06').score!;
    const irA = projectVisualScoreIR(bp06, scoreA).ir!;

    const editedYaml = bp06.replace('aspect_ratio: "2.39:1"', 'aspect_ratio: "16:9"');
    const scoreB = parseStageScore(editedYaml, 'bp06').score!;
    const irB = stabilizeVisualScoreIR(irA, projectVisualScoreIR(editedYaml, scoreB).ir!);

    expect(irB.rootFields).not.toBe(irA.rootFields);
    expect(irB.metadata).toBe(irA.metadata);
    expect(irB.optics).toBe(irA.optics);
    expect(irB.stage).toBe(irA.stage);
    expect(irB.entities).toBe(irA.entities);
    expect(irB.blocking).toBe(irA.blocking);
    expect(irB.shots).toBe(irA.shots);
    expect(irB.observerShots).toBe(irA.observerShots);
  });
});
