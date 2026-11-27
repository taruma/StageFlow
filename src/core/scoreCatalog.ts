/**
 * Bundled scene catalog registry for StageFlow.
 * Metadata index is generated at build time via `virtual:stageflow-catalog-index`
 * from `src/scores/catalog.yaml`, while full YAML payloads are lazy-loaded on demand.
 * Pure Layer 1 module: zero React and zero DOM/Three.js dependencies.
 */

import catalogIndex, {
  type BundledScoreIndexEntry,
} from 'virtual:stageflow-catalog-index';
import type { ScoreCategory, StageScore } from './types';
import { parseStageScore } from './scoreParser';
import { computeYamlContentHash } from './scoreYamlUtils';
import { parseInitialUrlQueryParams } from './scoreUrlLoader';

export interface ScoreCatalogItem {
  id: string;
  title: string;
  subtitle?: string;
  category: ScoreCategory;
  date?: string;
  updatedAt?: number;
  durationSec: number;
  shotCount: number;
  aspectRatio: number;
  videoUrl: string;
  isDefault?: boolean;
  rawYaml?: string;
  score?: StageScore;
  isCustom?: boolean;
  aliases?: string[];
  contentHash?: string;
  originalContentHash?: string;
  sourceUrl?: string;
  sourceFileName?: string;
}

/**
 * Parses an ISO `YYYY-MM-DD` or dot-separated `YYYY.MM.DD` catalog date into a UTC epoch timestamp (ms).
 */
export function parseIsoDateToEpochMs(dateStr?: string): number | undefined {
  if (!dateStr || typeof dateStr !== 'string') return undefined;
  const match = dateStr.trim().match(/^(\d{4})[-.](\d{2})[-.](\d{2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return undefined;
  }
  return dt.getTime();
}

export interface LoadedScoreCatalogItem extends ScoreCatalogItem {
  rawYaml: string;
  score: StageScore;
}

// Vite lazy-loads bundled YAML files as separate raw string chunks on demand
const lazyScoreModules = import.meta.glob<string>(
  '../scores/{studies,blueprints}/**/*.yaml',
  {
    query: '?raw',
    eager: false,
    import: 'default',
  }
);

const indexEntryById = new Map<string, BundledScoreIndexEntry>();
for (const entry of catalogIndex) {
  indexEntryById.set(entry.id, entry);
}

export const INITIAL_CATALOG_ITEMS: ScoreCatalogItem[] = catalogIndex.map(
  (entry) => ({
    id: entry.id,
    title: entry.title,
    subtitle: entry.subtitle,
    category: entry.category,
    ...(entry.date ? { date: entry.date, updatedAt: parseIsoDateToEpochMs(entry.date) } : {}),
    durationSec: entry.durationSec,
    shotCount: entry.shotCount,
    aspectRatio: entry.aspectRatio,
    videoUrl: entry.videoUrl,
    isDefault: entry.isDefault,
    isCustom: false,
    aliases: entry.aliases ?? [],
  })
);

const loadedBundledCache = new Map<string, LoadedScoreCatalogItem>();
const inFlightLoads = new Map<string, Promise<LoadedScoreCatalogItem>>();

/**
 * Resolves a lazy Vite module loader for a score path relative to `src/scores/`.
 * Normalizes relative paths and backslashes for cross-platform robustness.
 */
function resolveLazyScoreLoader(
  relFile: string
): (() => Promise<string>) | undefined {
  const target = relFile.replace(/^[./\\]+/, '').replace(/\\/g, '/');
  for (const [key, loader] of Object.entries(lazyScoreModules)) {
    const cleanKey = key.replace(/^[./\\]+/, '').replace(/\\/g, '/');
    if (cleanKey.endsWith(target)) {
      return loader;
    }
  }
  return undefined;
}

/**
 * Resolves a score catalog item by its canonical ID or any registered alias.
 * Searches provided catalog (if passed) or falls back to INITIAL_CATALOG_ITEMS.
 */
export function findCatalogItem(
  idOrAlias: string,
  catalog: ScoreCatalogItem[] = INITIAL_CATALOG_ITEMS
): ScoreCatalogItem | undefined {
  const normalized = idOrAlias.trim().toLowerCase();
  return catalog.find((item) => {
    if (item.id.toLowerCase() === normalized) return true;
    if (item.aliases?.some((a) => a.toLowerCase() === normalized)) return true;
    return false;
  });
}

/**
 * Checks whether a given scene ID corresponds to a factory bundled score (by canonical ID or alias).
 */
export function isBundledSceneId(id: string): boolean {
  return findCatalogItem(id, INITIAL_CATALOG_ITEMS) !== undefined;
}

/**
 * Returns the default catalog item (preferring `isDefault === true`, else `catalog[0]`).
 */
export function getDefaultCatalogItem(
  catalog: ScoreCatalogItem[] = INITIAL_CATALOG_ITEMS
): ScoreCatalogItem {
  const flagged = catalog.find((item) => item.isDefault === true);
  if (flagged) return flagged;
  const first = catalog[0];
  if (!first) {
    throw new Error('Score catalog is empty; cannot resolve default score.');
  }
  return first;
}

/**
 * Returns the canonical ID of the default bundled scene.
 */
export function getDefaultSceneId(): string {
  return getDefaultCatalogItem(INITIAL_CATALOG_ITEMS).id;
}

/**
 * Returns a cached loaded bundled score synchronously if already loaded, or `undefined`.
 */
export function getCachedBundledScore(
  idOrAlias: string
): LoadedScoreCatalogItem | undefined {
  const matched = findCatalogItem(idOrAlias, INITIAL_CATALOG_ITEMS);
  if (!matched) return undefined;
  return loadedBundledCache.get(matched.id);
}

/**
 * Lazily loads, parses, and hashes a single bundled score by canonical ID or alias.
 * Deduplicates concurrent in-flight requests and caches the parsed result.
 */
export async function loadBundledScore(
  idOrAlias: string
): Promise<LoadedScoreCatalogItem> {
  const matched = findCatalogItem(idOrAlias, INITIAL_CATALOG_ITEMS);
  if (!matched) {
    throw new Error(
      `Bundled score "${idOrAlias}" was not found in catalog manifest.`
    );
  }

  const cached = loadedBundledCache.get(matched.id);
  if (cached) {
    return cached;
  }

  const pending = inFlightLoads.get(matched.id);
  if (pending) {
    return pending;
  }

  const entry = indexEntryById.get(matched.id);
  if (!entry) {
    throw new Error(
      `Catalog index entry missing for bundled score "${matched.id}".`
    );
  }

  const loader = resolveLazyScoreLoader(entry.file);
  if (!loader) {
    throw new Error(
      `Score catalog manifest error: File "${entry.file}" specified for id "${entry.id}" was not found in src/scores/.`
    );
  }

  const loadPromise = (async (): Promise<LoadedScoreCatalogItem> => {
    const rawYaml = await loader();
    const parsed = parseStageScore(rawYaml, entry.id);
    if (!parsed.score) {
      throw new Error(
        `Failed to parse bundled score "${entry.file}" (${entry.id}): ${parsed.error}`
      );
    }

    const hash = computeYamlContentHash(rawYaml);
    const loadedItem: LoadedScoreCatalogItem = {
      id: entry.id,
      title: parsed.score.title,
      subtitle: parsed.score.subtitle,
      category: entry.category,
      ...(entry.date ? { date: entry.date, updatedAt: parseIsoDateToEpochMs(entry.date) } : {}),
      durationSec: parsed.score.durationSec,
      shotCount: parsed.score.shots.length,
      aspectRatio: parsed.score.aspectRatio,
      videoUrl: parsed.score.videoUrl,
      isDefault: entry.isDefault,
      rawYaml,
      score: parsed.score,
      isCustom: false,
      aliases: entry.aliases ?? [],
      contentHash: hash,
      originalContentHash: hash,
    };

    loadedBundledCache.set(entry.id, loadedItem);
    return loadedItem;
  })();

  inFlightLoads.set(matched.id, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inFlightLoads.delete(matched.id);
  }
}

/**
 * Loads and parses every bundled score in the catalog manifest.
 */
export async function loadAllBundledScores(): Promise<LoadedScoreCatalogItem[]> {
  return Promise.all(
    INITIAL_CATALOG_ITEMS.map((item) => loadBundledScore(item.id))
  );
}

/**
 * Preloads the single initial bundled score needed at Studio startup:
 * - Resolves `?score=` / `?scene=` from `search` first
 * - Else checks `storedSceneId`
 * - If bundled, loads that single score; otherwise loads `getDefaultSceneId()`
 */
export async function preloadInitialBundledScore(
  search?: string,
  storedSceneId?: string | null
): Promise<LoadedScoreCatalogItem> {
  const { scoreId } = parseInitialUrlQueryParams(search ?? '');
  if (scoreId && isBundledSceneId(scoreId)) {
    return loadBundledScore(scoreId);
  }
  if (!scoreId && storedSceneId && isBundledSceneId(storedSceneId)) {
    return loadBundledScore(storedSceneId);
  }
  return loadBundledScore(getDefaultSceneId());
}

/**
 * Generates a clean, minimal valid StageFlow choreography YAML score for new custom projects.
 */
export function generateBlankScoreYaml(
  id: string,
  title = 'New Custom Scene'
): string {
  return `# ==============================================================================
# STAGEFLOW CHOREOGRAPHY SCORE — ${title.toUpperCase()}
# ==============================================================================
version: "1.0"
id: "${id}"
title: "${title}"
subtitle: "Custom 3D Staging & Camera Diorama"
video: "procedural://${id}"
aspect_ratio: "16:9"
duration: 10.0

stage:
  width: 10
  depth: 10
  grid_step: 1
  observer_camera:
    target: [0, 1.1, 0]
    distance: 7.5
    pitch: 25
    yaw: 35
    lens: 35mm
  stage_camera:
    target: [0, 1.25, 0]
    distance: 4.5
    pitch: 5
    yaw: 0
    lens: 35mm

entities:
  - id: "actor_1"
    label: "Actor 1"
    kind: "character"
    position: [0, 0, 0]
    rotation: 0
    height: 1.75
    color: "#38bdf8"

shots:
  - id: "shot-1"
    shot: 1
    label: "Establishing Shot"
    start: 0.0
    end: 10.0
    stage_camera:
      target: "actor_1"
      maneuver: "cut"
      easing: "smooth"
      distance: 4.5
      pitch: 5
      yaw: 0
      lens: 35mm
`;
}
