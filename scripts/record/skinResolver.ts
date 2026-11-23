/**
 * CLI .glb / .gltf Skin File Resolver & Playwright Virtual Route Builder.
 */

import fs from 'node:fs';
import path from 'node:path';
import { suggestSkinTargetId } from '../../src/core/skinMath';
import type { SceneEntityDef } from '../../src/core/types';

export interface ResolvedRecorderSkins {
  stageSkinFilePath?: string;
  entitySkinFilePaths: Record<string, string>;
  /** Virtual URLs passed inside RecorderConfig */
  stageSkinUrl?: string;
  entitySkinUrls: Record<string, string>;
  /** Virtual pathname -> local disk file path & MIME type for Playwright route interception */
  routeMap: Map<string, { filePath: string; contentType: string }>;
}

export function parseEntitySkinAssignment(spec: string): {
  entityId: string;
  filePath: string;
} {
  const eqIndex = spec.indexOf('=');
  if (eqIndex <= 0 || eqIndex === spec.length - 1) {
    throw new Error(
      `Invalid --entity-skin value "${spec}". Expected format: <entity_id>=<path/to/model.glb>`
    );
  }
  const entityId = spec.slice(0, eqIndex).trim();
  const filePath = spec.slice(eqIndex + 1).trim();
  if (!entityId || !filePath) {
    throw new Error(
      `Invalid --entity-skin value "${spec}". Expected non-empty <entity_id>=<path>.`
    );
  }
  return { entityId, filePath };
}

function getSkinMimeType(filePath: string): string {
  return filePath.toLowerCase().endsWith('.gltf')
    ? 'model/gltf+json'
    : 'model/gltf-binary';
}

function getSkinExtension(filePath: string): string {
  return filePath.toLowerCase().endsWith('.gltf') ? '.gltf' : '.glb';
}

function verifySkinFileExists(rawPath: string, label: string): string {
  const resolved = path.resolve(rawPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(`${label} skin file not found: "${rawPath}"`);
  }
  return resolved;
}

const STAGE_DIR_STEMS = new Set([
  'stage',
  'stage_environment',
  'stage_skin',
  'environment',
  'env',
  'set',
]);

function isExplicitStageSkinFilename(fileName: string): boolean {
  const stem = fileName
    .toLowerCase()
    .replace(/\.(glb|gltf)$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return STAGE_DIR_STEMS.has(stem);
}

export function resolveRecorderSkins(
  options: {
    stageSkinPath?: string;
    entitySkinPaths?: Record<string, string>;
    skinsDir?: string;
  },
  entities: SceneEntityDef[]
): ResolvedRecorderSkins {
  let stageSkinFilePath: string | undefined;
  const entitySkinFilePaths: Record<string, string> = {};

  // 1. Optional directory scan (--skins-dir) using suggestSkinTargetId
  if (options.skinsDir) {
    const resolvedDir = path.resolve(options.skinsDir);
    if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
      throw new Error(`Skins directory not found: "${options.skinsDir}"`);
    }

    const entries = fs
      .readdirSync(resolvedDir, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && /\.(glb|gltf)$/i.test(entry.name)
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(resolvedDir, entry.name);
      if (isExplicitStageSkinFilename(entry.name)) {
        if (!stageSkinFilePath) {
          stageSkinFilePath = fullPath;
        }
        continue;
      }

      const targetId = suggestSkinTargetId(entry.name, entities);
      if (targetId !== 'stage' && !entitySkinFilePaths[targetId]) {
        entitySkinFilePaths[targetId] = fullPath;
      }
    }
  }

  // 2. Explicit CLI overrides (--stage-skin and --entity-skin)
  if (options.stageSkinPath) {
    stageSkinFilePath = verifySkinFileExists(options.stageSkinPath, 'Stage');
  }

  if (options.entitySkinPaths) {
    for (const [entityId, rawPath] of Object.entries(options.entitySkinPaths)) {
      entitySkinFilePaths[entityId] = verifySkinFileExists(
        rawPath,
        `Entity "${entityId}"`
      );
    }
  }

  // 3. Build deterministic Playwright virtual URL routes
  const routeMap = new Map<string, { filePath: string; contentType: string }>();
  let stageSkinUrl: string | undefined;
  const entitySkinUrls: Record<string, string> = {};

  if (stageSkinFilePath) {
    const ext = getSkinExtension(stageSkinFilePath);
    const virtualPath = `/__stageflow_skin__/stage${ext}`;
    stageSkinUrl = virtualPath;
    routeMap.set(virtualPath, {
      filePath: stageSkinFilePath,
      contentType: getSkinMimeType(stageSkinFilePath),
    });
  }

  const sortedEntityEntries = Object.entries(entitySkinFilePaths).sort(
    ([a], [b]) => a.localeCompare(b)
  );
  sortedEntityEntries.forEach(([entityId, filePath], idx) => {
    const safeId = entityId.replace(/[^a-zA-Z0-9_-]+/g, '_');
    const ext = getSkinExtension(filePath);
    const virtualPath = `/__stageflow_skin__/entity_${idx}_${safeId}${ext}`;
    entitySkinUrls[entityId] = virtualPath;
    routeMap.set(virtualPath, {
      filePath,
      contentType: getSkinMimeType(filePath),
    });
  });

  return {
    stageSkinFilePath,
    entitySkinFilePaths,
    stageSkinUrl,
    entitySkinUrls,
    routeMap,
  };
}
