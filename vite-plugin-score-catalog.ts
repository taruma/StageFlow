/**
 * Vite plugin that generates a lightweight build-time metadata index
 * (`virtual:stageflow-catalog-index`) from `src/scores/catalog.yaml` and its
 * referenced score YAML files so full YAML payloads can be lazy-loaded on demand.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:stageflow-catalog-index';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const DEFAULT_ASPECT_RATIO = 16 / 9;

interface CatalogManifestEntry {
  id: string;
  file: string;
  category?: 'study' | 'blueprint' | 'custom';
  aliases?: string[];
  default?: boolean;
}

export interface BundledScoreIndexEntry {
  id: string;
  file: string;
  category: 'study' | 'blueprint' | 'custom';
  aliases: string[];
  isDefault: boolean;
  title: string;
  subtitle?: string;
  videoUrl: string;
  durationSec: number;
  shotCount: number;
  aspectRatio: number;
}

function parseAspectRatioValue(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0.1) {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':').map((p) => parseFloat(p.trim()));
      if (
        parts.length === 2 &&
        Number.isFinite(parts[0]) &&
        Number.isFinite(parts[1]) &&
        parts[0] > 0 &&
        parts[1] > 0
      ) {
        return parts[0] / parts[1];
      }
    }
    const num = parseFloat(trimmed);
    if (Number.isFinite(num) && num > 0.1) {
      return num;
    }
  }
  return DEFAULT_ASPECT_RATIO;
}

function extractMaxEnd(list: unknown): number {
  if (!Array.isArray(list)) return 0;
  let maxEnd = 0;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawEnd = rec.end ?? rec._end;
    if (typeof rawEnd === 'number' && Number.isFinite(rawEnd) && rawEnd > maxEnd) {
      maxEnd = rawEnd;
    }
  }
  return maxEnd;
}

function extractVideoInfo(doc: Record<string, unknown>): {
  videoUrl: string;
  videoAspectRatio?: unknown;
} {
  let videoUrl = 'procedural://demo';
  let videoAspectRatio: unknown;

  if (typeof doc.video === 'string' && doc.video.trim().length > 0) {
    videoUrl = doc.video.trim();
  } else if (doc.video && typeof doc.video === 'object') {
    const vObj = doc.video as Record<string, unknown>;
    const candidate = vObj.src ?? vObj.url;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      videoUrl = candidate.trim();
    }
    if (vObj.aspect_ratio !== undefined || vObj.aspectRatio !== undefined) {
      videoAspectRatio = vObj.aspect_ratio ?? vObj.aspectRatio;
    }
  } else if (
    typeof doc.video_url === 'string' &&
    doc.video_url.trim().length > 0
  ) {
    videoUrl = doc.video_url.trim();
  } else if (
    typeof doc.videoUrl === 'string' &&
    doc.videoUrl.trim().length > 0
  ) {
    videoUrl = doc.videoUrl.trim();
  }

  return { videoUrl, videoAspectRatio };
}

function buildCatalogIndexEntries(
  scoresDir: string,
  addWatchFile?: (id: string) => void
): BundledScoreIndexEntry[] {
  const manifestPath = path.join(scoresDir, 'catalog.yaml');
  addWatchFile?.(manifestPath);

  const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
  const parsedManifest = yaml.parse(manifestRaw);

  if (!Array.isArray(parsedManifest)) {
    throw new Error(
      'Invalid src/scores/catalog.yaml: Expected top-level array of score entries.'
    );
  }

  const entries: BundledScoreIndexEntry[] = [];

  for (const rawEntry of parsedManifest as CatalogManifestEntry[]) {
    if (!rawEntry?.id || !rawEntry?.file) {
      throw new Error(
        'Invalid src/scores/catalog.yaml entry: Missing "id" or "file" property.'
      );
    }

    const relFile = String(rawEntry.file)
      .replace(/^[./\\]+/, '')
      .replace(/\\/g, '/');
    const scorePath = path.resolve(scoresDir, relFile);
    if (!fs.existsSync(scorePath)) {
      throw new Error(
        `Score catalog manifest error: File "${rawEntry.file}" specified for id "${rawEntry.id}" was not found in src/scores/.`
      );
    }

    addWatchFile?.(scorePath);

    const rawYaml = fs.readFileSync(scorePath, 'utf-8');
    const parsedScore = yaml.parse(rawYaml);
    const doc =
      parsedScore && typeof parsedScore === 'object' && !Array.isArray(parsedScore)
        ? (parsedScore as Record<string, unknown>)
        : {};

    const title =
      typeof doc.title === 'string' && doc.title.trim().length > 0
        ? doc.title
        : rawEntry.id;
    const subtitle =
      typeof doc.subtitle === 'string' ? doc.subtitle : undefined;

    const { videoUrl, videoAspectRatio } = extractVideoInfo(doc);
    const aspectRatio = parseAspectRatioValue(
      doc.aspect_ratio ?? doc.aspectRatio ?? videoAspectRatio
    );

    const rawShots = Array.isArray(doc.shots ?? doc.score)
      ? ((doc.shots ?? doc.score) as unknown[])
      : [];
    const shotCount = rawShots.filter(
      (shot) => shot !== null && typeof shot === 'object'
    ).length;

    let durationSec = 10;
    if (
      typeof doc.duration === 'number' &&
      Number.isFinite(doc.duration) &&
      doc.duration > 0
    ) {
      durationSec = doc.duration;
    } else {
      const maxEnd = Math.max(
        extractMaxEnd(doc.shots ?? doc.score),
        extractMaxEnd(doc.observer_shots ?? doc.observerShots),
        extractMaxEnd(doc.blocking)
      );
      if (maxEnd > 0) {
        durationSec = maxEnd;
      }
    }

    const category =
      rawEntry.category === 'study' ||
      rawEntry.category === 'blueprint' ||
      rawEntry.category === 'custom'
        ? rawEntry.category
        : 'blueprint';

    entries.push({
      id: String(rawEntry.id),
      file: relFile,
      category,
      aliases: Array.isArray(rawEntry.aliases)
        ? rawEntry.aliases.map(String)
        : [],
      isDefault: Boolean(rawEntry.default),
      title,
      ...(subtitle !== undefined ? { subtitle } : {}),
      videoUrl,
      durationSec,
      shotCount,
      aspectRatio,
    });
  }

  return entries;
}

export function scoreCatalogPlugin(): Plugin {
  let rootDir = process.cwd();

  return {
    name: 'stageflow-score-catalog',

    configResolved(config) {
      rootDir = config.root;
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      return null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
        return null;
      }
      const scoresDir = path.resolve(rootDir, 'src/scores');
      const entries = buildCatalogIndexEntries(scoresDir, (filePath) => {
        if (typeof this.addWatchFile === 'function') {
          this.addWatchFile(filePath);
        }
      });
      return `export default ${JSON.stringify(entries, null, 2)};\n`;
    },

    configureServer(server) {
      const invalidateIfScoreYaml = (filePath: string) => {
        const normalized = filePath.replace(/\\/g, '/');
        if (normalized.includes('/src/scores/') && normalized.endsWith('.yaml')) {
          const mod = server.moduleGraph.getModuleById(
            RESOLVED_VIRTUAL_MODULE_ID
          );
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
          }
        }
      };

      server.watcher.on('add', invalidateIfScoreYaml);
      server.watcher.on('change', invalidateIfScoreYaml);
      server.watcher.on('unlink', invalidateIfScoreYaml);
    },

    handleHotUpdate(ctx) {
      const normalized = ctx.file.replace(/\\/g, '/');
      if (normalized.includes('/src/scores/') && normalized.endsWith('.yaml')) {
        const mod = ctx.server.moduleGraph.getModuleById(
          RESOLVED_VIRTUAL_MODULE_ID
        );
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod);
          return [...ctx.modules, mod];
        }
      }
      return undefined;
    },
  };
}
