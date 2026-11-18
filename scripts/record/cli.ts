/**
 * Command-Line Interface for StageFlow deterministic 60fps recording.
 * Run via `npm run record [scene] [options]`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_CATALOG_ITEMS, findCatalogItem } from '../../src/core/scoreCatalog';
import { parseStageScore } from '../../src/core/scoreParser';
import { parseArgs } from './cliArgs';
import { runRecordSession } from './playwrightDriver';
import { ensureViteServer } from './serverManager';
import { resolveRecorderSkins } from './skinResolver';

function resolveScoreYaml(input: string): { yaml: string; id: string } {
  // Check if file exists on disk
  if (fs.existsSync(input)) {
    const yaml = fs.readFileSync(input, 'utf-8');
    const filename = path.basename(input, path.extname(input));
    return { yaml, id: filename };
  }

  // Check direct canonical ID or alias match
  const directMatch = findCatalogItem(input);
  if (directMatch) {
    return { yaml: directMatch.rawYaml, id: directMatch.id };
  }

  // Check aliases for study scenes: vf, vector_field, vector-field
  const normalized = input.trim().toLowerCase().replace(/_/g, '-');
  if (
    normalized === 'vf' ||
    normalized === 'vector-field' ||
    normalized === 'vectorfield'
  ) {
    const vfItem = findCatalogItem('vector-field');
    if (vfItem) {
      return { yaml: vfItem.rawYaml, id: vfItem.id };
    }
  }

  // Check numeric shortcuts: 01, 02, 03, 04, 05, 06, 07 (mapped to Blueprint numbers)
  const numMatch = input.match(/^(?:bp)?0?([1-9]\d*)$/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    const targetBpId = num === 1 ? 'demo' : `blueprint-0${num}`;
    const bpItem = findCatalogItem(targetBpId);
    if (bpItem) {
      return { yaml: bpItem.rawYaml, id: bpItem.id };
    }
  }

  // Check catalog IDs or substring matches (e.g. vector-field, demo-blueprint, optics-dof)
  const catalogItem = INITIAL_CATALOG_ITEMS.find(
    (item) =>
      item.id.toLowerCase() === normalized ||
      item.id.toLowerCase().includes(normalized) ||
      item.id.toLowerCase().replace(/-/g, '_').includes(input.toLowerCase()) ||
      item.aliases?.some((a) => a.toLowerCase().includes(normalized))
  );
  if (catalogItem) {
    return { yaml: catalogItem.rawYaml, id: catalogItem.id };
  }

  throw new Error(
    `Unknown scene: "${input}". Provide a valid file path or bundled ID (${INITIAL_CATALOG_ITEMS.map((i) => i.id).join(', ')}).`
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { yaml, id: sceneId } = resolveScoreYaml(options.sceneInput);
  const needsParsedScore = Boolean(
    options.shotId || options.skinsDir || options.stageSkinPath || options.entitySkinPaths
  );
  const parsedScore = needsParsedScore ? parseStageScore(yaml).score : null;

  // If a specific shot was requested, extract shot timestamps
  if (options.shotId) {
    const targetShot = parsedScore?.shots.find(
      (s) => s.id.toLowerCase() === options.shotId!.toLowerCase()
    );
    if (!targetShot) {
      throw new Error(
        `Shot "${options.shotId}" not found in scene "${sceneId}". Available shots: ${parsedScore?.shots.map((s) => s.id).join(', ')}`
      );
    }
    options.startSec = targetShot.startSec;
    options.endSec = targetShot.endSec;
  }

  const skins = resolveRecorderSkins(options, parsedScore?.entities ?? []);

  const server = await ensureViteServer(options.port);

  try {
    await runRecordSession(options, yaml, server.url, skins);
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error('\n❌ Recording failed:', err.message);
  process.exit(1);
});
