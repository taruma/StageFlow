import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CAMERA_EASINGS,
  CAMERA_MANEUVERS,
  CAMERA_RIG_TYPES,
  DOF_PRESETS,
  ENTITY_KINDS,
  lookupFieldDescriptor,
} from '../../src/core/scoreSchema';
import {
  normalizeCameraEasing,
  normalizeCameraManeuver,
  normalizeEntityKind,
  parseDofPreset,
} from '../../src/core/scorePrimitives';
import { parseStageScore } from '../../src/core/scoreParser';
import { generateBlankScoreYaml } from '../../src/core/scoreCatalog';
import { projectVisualScoreIR } from '../../src/core/scoreYamlProjection';

const SCORES_ROOT = path.resolve(__dirname, '../../src/scores');

function collectYamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectYamlFiles(full));
    } else if (entry.name.endsWith('.yaml') && entry.name !== 'catalog.yaml') {
      out.push(full);
    }
  }
  return out;
}

describe('scoreSchemaContract', () => {
  it('verifies every key authored across all 19 bundled scores is registered in scoreSchema', () => {
    const files = collectYamlFiles(SCORES_ROOT);
    expect(files.length).toBe(19);

    const unregistered: string[] = [];

    for (const file of files) {
      const rel = path.relative(SCORES_ROOT, file);
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = parseStageScore(raw, rel);
      expect(parsed.error, `Failed parsing ${rel}`).toBeNull();

      const { ir, error } = projectVisualScoreIR(raw, parsed.score);
      expect(error, `Failed projecting ${rel}`).toBeNull();
      const doc = ir!;

      for (const f of doc.rootFields) {
        if (!f.descriptor) unregistered.push(`${rel} -> root.${f.key}`);
      }
      for (const f of doc.optics.fields) {
        if (!f.descriptor) unregistered.push(`${rel} -> optics.${f.key}`);
      }
      for (const f of doc.stage.fields) {
        if (!f.descriptor) unregistered.push(`${rel} -> stage.${f.key}`);
      }
      for (const f of doc.stage.observerCamera?.fields ?? []) {
        if (!f.descriptor) unregistered.push(`${rel} -> stage.observer_camera.${f.key}`);
      }
      for (const f of doc.stage.stageCamera?.fields ?? []) {
        if (!f.descriptor) unregistered.push(`${rel} -> stage.stage_camera.${f.key}`);
      }
      for (const ent of doc.entities) {
        for (const f of ent.fields) {
          if (!f.descriptor) unregistered.push(`${rel} -> entity[${ent.id}].${f.key}`);
        }
      }
      for (const blk of doc.blocking) {
        for (const f of blk.fields) {
          if (!f.descriptor) unregistered.push(`${rel} -> blocking[${blk.id}].${f.key}`);
        }
        for (const ov of blk.entityOverrides) {
          for (const f of ov.fields) {
            if (!f.descriptor) {
              unregistered.push(`${rel} -> blocking[${blk.id}].entities.${ov.name}.${f.key}`);
            }
          }
        }
      }
      for (const shot of doc.shots) {
        for (const f of shot.fields) {
          if (!f.descriptor) unregistered.push(`${rel} -> shot[${shot.id}].${f.key}`);
        }
        for (const f of shot.stageCamera?.fields ?? []) {
          if (!f.descriptor) unregistered.push(`${rel} -> shot[${shot.id}].stageCamera.${f.key}`);
        }
        for (const f of shot.stageCamera?.rig?.fields ?? []) {
          if (!f.descriptor) unregistered.push(`${rel} -> shot[${shot.id}].rig.${f.key}`);
        }
        for (const f of shot.flatRig?.fields ?? []) {
          if (!f.descriptor) unregistered.push(`${rel} -> shot[${shot.id}].flatRig.${f.key}`);
        }
        for (const wp of shot.stageCamera?.waypoints ?? []) {
          for (const f of wp.fields) {
            if (!f.descriptor) unregistered.push(`${rel} -> shot[${shot.id}].waypoint.${f.key}`);
          }
        }
        for (const f of shot.observerCamera?.fields ?? []) {
          if (!f.descriptor) unregistered.push(`${rel} -> shot[${shot.id}].observerCamera.${f.key}`);
        }
        for (const ov of shot.entityOverrides) {
          for (const f of ov.fields) {
            if (!f.descriptor) unregistered.push(`${rel} -> shot[${shot.id}].entities.${ov.name}.${f.key}`);
          }
        }
      }
      for (const os of doc.observerShots) {
        for (const f of os.fields) {
          if (!f.descriptor) unregistered.push(`${rel} -> observerShot[${os.id}].${f.key}`);
        }
        for (const f of os.camera?.fields ?? []) {
          if (!f.descriptor) unregistered.push(`${rel} -> observerShot[${os.id}].camera.${f.key}`);
        }
        for (const wp of os.flatWaypoints ?? []) {
          for (const f of wp.fields) {
            if (!f.descriptor) unregistered.push(`${rel} -> observerShot[${os.id}].waypoint.${f.key}`);
          }
        }
      }
    }

    expect(unregistered).toEqual([]);
  }, 15_000);

  it('round-trips all schema enums cleanly through core normalizers', () => {
    for (const m of CAMERA_MANEUVERS) {
      if (m === 'straight') {
        expect(normalizeCameraManeuver(m)).toBe('dolly');
      } else {
        expect(normalizeCameraManeuver(m)).toBe(m);
      }
    }
    for (const e of CAMERA_EASINGS) {
      expect(normalizeCameraEasing(e)).toBe(e);
    }
    for (const d of DOF_PRESETS) {
      expect(parseDofPreset(d)).toBe(d);
    }
    for (const k of ENTITY_KINDS) {
      expect(normalizeEntityKind(k)).toBe(k);
    }
    expect(CAMERA_RIG_TYPES).toEqual(['tripod', 'track', 'spline_track']);
  });

  it('resolves canonical keys and documented aliases via lookupFieldDescriptor', () => {
    expect(lookupFieldDescriptor('cameraCue', 'focal_length')?.key).toBe('lens');
    expect(lookupFieldDescriptor('cameraCue', 'dutch')?.key).toBe('roll');
    expect(lookupFieldDescriptor('entity', 'yaw')?.key).toBe('rotation');
    expect(lookupFieldDescriptor('shot', '_start')?.key).toBe('start');
    expect(lookupFieldDescriptor('blockingCue', 'actor')?.key).toBe('entity');
    expect(lookupFieldDescriptor('blockingEntity', 'length')?.key).toBe('depth');
    expect(lookupFieldDescriptor('entity', 'scale')?.key).toBe('scale');
  });

  it('scopes stageBaseCamera, observerCameraCue, observerShot, and shot root strictly to parser-supported keys', () => {
    expect(lookupFieldDescriptor('stageBaseCamera', 'target')?.key).toBe('target');
    expect(lookupFieldDescriptor('stageBaseCamera', 'lens')?.key).toBe('lens');
    expect(lookupFieldDescriptor('stageBaseCamera', 'maneuver')).toBeNull();
    expect(lookupFieldDescriptor('stageBaseCamera', 'focus')).toBeNull();

    expect(lookupFieldDescriptor('observerCameraCue', 'maneuver')?.key).toBe('maneuver');
    expect(lookupFieldDescriptor('observerCameraCue', 'focus')).toBeNull();
    expect(lookupFieldDescriptor('observerCameraCue', 'frustum_depth')).toBeNull();
    expect(lookupFieldDescriptor('observerShot', 'dof')).toBeNull();
    expect(lookupFieldDescriptor('observerShot', 'aperture')).toBeNull();

    expect(lookupFieldDescriptor('shot', 'focus')?.key).toBe('focus');
    expect(lookupFieldDescriptor('shot', 'dof')?.key).toBe('dof');
    expect(lookupFieldDescriptor('shot', 'show_rig')?.key).toBe('show_rig');
    expect(lookupFieldDescriptor('shot', 'distance')).toBeNull();
    expect(lookupFieldDescriptor('shot', 'maneuver')).toBeNull();
    expect(lookupFieldDescriptor('shot', 'target')).toBeNull();
  });

  it('generates blank score YAML with canonical schema keys and zero unregistered fields', () => {
    const raw = generateBlankScoreYaml('blank-contract-test', 'Blank Test');
    const parsed = parseStageScore(raw, 'blank-contract-test');
    expect(parsed.error).toBeNull();
    expect(parsed.warning).toBeNull();
    expect(parsed.score?.shots[0]?.stageCamera?.maneuver).toBe('cut');
    expect(parsed.score?.shots[0]?.stageCamera?.easing).toBe('smooth');

    const { ir, error } = projectVisualScoreIR(raw, parsed.score);
    expect(error).toBeNull();
    const doc = ir!;
    const unregistered: string[] = [];

    for (const f of doc.rootFields) {
      if (!f.descriptor) unregistered.push(`root.${f.key}`);
    }
    for (const f of doc.stage.fields) {
      if (!f.descriptor) unregistered.push(`stage.${f.key}`);
    }
    for (const f of doc.stage.observerCamera?.fields ?? []) {
      if (!f.descriptor) unregistered.push(`stage.observer_camera.${f.key}`);
    }
    for (const f of doc.stage.stageCamera?.fields ?? []) {
      if (!f.descriptor) unregistered.push(`stage.stage_camera.${f.key}`);
    }
    for (const ent of doc.entities) {
      for (const f of ent.fields) {
        if (!f.descriptor) unregistered.push(`entity[${ent.id}].${f.key}`);
      }
    }
    for (const shot of doc.shots) {
      for (const f of shot.fields) {
        if (!f.descriptor) unregistered.push(`shot[${shot.id}].${f.key}`);
      }
      for (const f of shot.stageCamera?.fields ?? []) {
        if (!f.descriptor) unregistered.push(`shot[${shot.id}].stageCamera.${f.key}`);
      }
    }

    expect(unregistered).toEqual([]);
  });
});
