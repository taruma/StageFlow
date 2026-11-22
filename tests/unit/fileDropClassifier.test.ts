import { describe, expect, it } from 'vitest';
import {
  classifyDroppedAsset,
  hasFilesInDataTransfer,
} from '../../src/core/fileDropClassifier';

describe('fileDropClassifier', () => {
  it('classifies YAML and JSON choreography score files', () => {
    expect(classifyDroppedAsset('scene.yaml')).toBe('yaml');
    expect(classifyDroppedAsset('SCENE.YML')).toBe('yaml');
    expect(classifyDroppedAsset('score.json')).toBe('yaml');
  });

  it('classifies video files by extension or MIME type', () => {
    expect(classifyDroppedAsset('reference.mp4')).toBe('video');
    expect(classifyDroppedAsset('clip.WEBM')).toBe('video');
    expect(classifyDroppedAsset('take.mov')).toBe('video');
    expect(classifyDroppedAsset('unknown.bin', 'video/mp4')).toBe('video');
  });

  it('classifies 3D .glb and .gltf skin files by extension or MIME type', () => {
    expect(classifyDroppedAsset('hero.glb')).toBe('skin');
    expect(classifyDroppedAsset('StageSet.GLTF')).toBe('skin');
    expect(classifyDroppedAsset('model', 'model/gltf-binary')).toBe('skin');
    expect(classifyDroppedAsset('model', 'model/gltf+json')).toBe('skin');
  });

  it('returns unsupported for unrelated file extensions and MIME types', () => {
    expect(classifyDroppedAsset('notes.txt', 'text/plain')).toBe('unsupported');
    expect(classifyDroppedAsset('texture.png', 'image/png')).toBe('unsupported');
  });

  it('detects OS file drags while ignoring internal text or UI drags', () => {
    expect(hasFilesInDataTransfer(null)).toBe(false);
    expect(hasFilesInDataTransfer(undefined)).toBe(false);
    expect(hasFilesInDataTransfer({ types: ['text/plain', 'text/html'] })).toBe(
      false
    );
    expect(hasFilesInDataTransfer({ types: ['Files'] })).toBe(true);
    expect(hasFilesInDataTransfer({ types: ['text/uri-list', 'Files'] })).toBe(
      true
    );
  });
});
