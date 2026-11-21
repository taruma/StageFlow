/**
 * CLI argument parsing, usage help, and default output path resolution
 * for the StageFlow deterministic viewport recorder.
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  AppThemeCategory,
  CameraViewMode,
  LabelDisplayMode,
} from '../../src/core/types';
import { CAMERA_PRESETS } from './cameraPresets';
import type {
  CaptureFormat,
  CliOptions,
  ResolutionPresetKey,
} from './recorderTypes';
import { RESOLUTION_PRESETS } from './recorderTypes';
import { parseEntitySkinAssignment } from './skinResolver';

export function printHelp(): void {
  console.log(`
StageFlow Deterministic 60fps Viewport Recorder CLI

Usage:
  npm run record [scene] [options]

Arguments:
  scene                   Bundled shortcut (01-06, vf, vector-field)
                          or bundled ID (blueprint_01_two_shot_arc, etc.)
                          or a path to a custom .yaml / .json file.
                          Default: "blueprint_01_two_shot_arc".

Options:
  --camera <mode>         "scripted" (default) or "stage-pov"
  --blur, --dof-blur      Force thin-lens DoF bokeh blur ON (Stage Cam POV)
  --no-blur               Force thin-lens DoF bokeh blur OFF
  --theme <category>      Diorama theme: "dark" (default), "warm", or "light"
  --labels <mode>         "all" (default), "camera-only", or "off"
  --guides                Show optical viewfinder composition guides
  --hud                   Include 2D shot breakdown and telemetry badges
  --preset <name>         Camera angle preset: isometric (iso), top-down (top), front, side
  --shot <shot_id>        Record only a specific shot (e.g. shot_01)
  --start <sec>           Custom start timestamp in seconds
  --end <sec>             Custom end timestamp in seconds
  --audio <file>          Path to reference video/audio to slap audio track onto output
  --stage-skin <path>     Path to .glb/.gltf file for the Stage Environment skin
  --entity-skin <id=path> Assign .glb/.gltf to an entity ID (repeatable, e.g. hero=hero.glb)
  --skins-dir <dir>       Auto-match .glb/.gltf skins in a directory by entity ID / stage
  --workers <n>           Parallel Playwright worker tabs (default: auto-optimized)
  --capture <fmt>         Intermediate capture: "jpeg" (q=96, default for video) or "png"
  --software-gl           Disable hardware ANGLE GPU preference (CI SwiftShader fallback)
  --fps <number>          Locked framerate (default: 60)
  --res <preset>          Resolution preset: 1080p, 4k, 720p, square, vertical
  --width <w>             Custom pixel width (e.g. 1920)
  --height <h>            Custom pixel height (e.g. 1080)
  --format <fmt>          mp4 (default), webm, gif, sequence
  -o, --output <path>     Destination file or directory path (default: recordings/<scene>_<camera>.<ext>)
  --preview               Show Chromium browser window during recording
  --port <number>         Vite dev server port (default: 5173)
  -h, --help              Show this help message

Examples:
  npm run record 01
  npm run record 06 -- --camera stage-pov --blur -o rack_focus.mp4
  npm run record 01 -- --camera stage-pov -o stage_pov.mp4
  npm run record 02 -- --labels off --shot shot_01 -o clean_shot.mp4
  npm run record 04 -- --preset isometric --res 4k --theme warm -o overview_warm.mp4
`);
}

/**
 * Extracts a clean filename-safe scene slug from either a bundled shortcut/ID
 * or a local Windows/POSIX score file path.
 */
export function extractSceneSlug(sceneInput: string): string {
  const withoutDrive = sceneInput.trim().replace(/^[a-zA-Z]:/, '');
  const normalized = withoutDrive.replace(/\\/g, '/').replace(/\/+$/, '');
  const base = path.posix.basename(normalized);
  const ext = path.posix.extname(base);
  const isScoreExtension = ['.yaml', '.yml', '.json'].includes(ext.toLowerCase());
  const slug = isScoreExtension ? base.slice(0, -ext.length) : base;
  return slug || 'scene';
}

/**
 * Resolves the default destination path inside `recordings/` when `-o` is omitted
 * or points to a directory.
 */
export function resolveDefaultOutputPath(
  sceneInput: string,
  cameraMode: CameraViewMode,
  format: CliOptions['format'],
  outputDir = 'recordings'
): string {
  const sceneSlug = extractSceneSlug(sceneInput);
  const ext = format === 'sequence' ? '' : `.${format}`;
  return path.join(outputDir, `${sceneSlug}_${cameraMode}${ext}`);
}

export function parseArgs(
  args: string[],
  options?: { onHelp?: () => void }
): CliOptions {
  let sceneInput = 'blueprint_01_two_shot_arc';
  let cameraMode: CameraViewMode = 'scripted';
  let presetName: string | undefined;
  let labels: LabelDisplayMode = 'all';
  let guides = false;
  let hud = false;
  let dofBlur: boolean | undefined = undefined;
  let theme: AppThemeCategory | undefined = undefined;
  let fps = 60;
  let resPreset: ResolutionPresetKey = '1080p';
  let customWidth: number | undefined;
  let customHeight: number | undefined;
  let shotId: string | undefined;
  let startSec: number | undefined;
  let endSec: number | undefined;
  let audioPath: string | undefined;
  let stageSkinPath: string | undefined;
  let entitySkinPaths: Record<string, string> | undefined;
  let skinsDir: string | undefined;
  let workers: number | undefined;
  let captureFormat: CaptureFormat | undefined;
  let softwareGl = false;
  let format: CliOptions['format'] = 'mp4';
  let outputPath: string | undefined;
  let preview = false;
  let port = 5173;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      if (options?.onHelp) {
        options.onHelp();
      } else {
        printHelp();
        process.exit(0);
      }
    } else if (arg === '--camera' && args[i + 1]) {
      cameraMode = args[++i] as CameraViewMode;
    } else if (arg === '--blur' || arg === '--dof-blur') {
      dofBlur = true;
    } else if (arg === '--no-blur' || arg === '--no-dof-blur') {
      dofBlur = false;
    } else if (arg === '--theme' && args[i + 1]) {
      theme = args[++i] as AppThemeCategory;
    } else if (arg === '--labels' && args[i + 1]) {
      labels = args[++i] as LabelDisplayMode;
    } else if (arg === '--guides') {
      guides = true;
    } else if (arg === '--hud') {
      hud = true;
    } else if (arg === '--preset' && args[i + 1]) {
      presetName = args[++i];
    } else if (arg === '--shot' && args[i + 1]) {
      shotId = args[++i];
    } else if (arg === '--start' && args[i + 1]) {
      startSec = parseFloat(args[++i]);
    } else if (arg === '--end' && args[i + 1]) {
      endSec = parseFloat(args[++i]);
    } else if (arg === '--fps' && args[i + 1]) {
      fps = parseInt(args[++i], 10);
    } else if (arg === '--res' && args[i + 1]) {
      resPreset = args[++i] as ResolutionPresetKey;
    } else if (arg === '--width' && args[i + 1]) {
      customWidth = parseInt(args[++i], 10);
    } else if (arg === '--height' && args[i + 1]) {
      customHeight = parseInt(args[++i], 10);
    } else if (arg === '--format' && args[i + 1]) {
      format = args[++i] as CliOptions['format'];
    } else if (arg === '--audio' && args[i + 1]) {
      audioPath = args[++i];
    } else if (arg === '--stage-skin' && args[i + 1]) {
      stageSkinPath = args[++i];
    } else if (arg === '--entity-skin' && args[i + 1]) {
      const { entityId, filePath } = parseEntitySkinAssignment(args[++i]);
      entitySkinPaths = entitySkinPaths ?? {};
      entitySkinPaths[entityId] = filePath;
    } else if (arg === '--skins-dir' && args[i + 1]) {
      skinsDir = args[++i];
    } else if (arg === '--workers' && args[i + 1]) {
      workers = parseInt(args[++i], 10);
    } else if (arg === '--capture' && args[i + 1]) {
      const cap = args[++i].toLowerCase();
      if (cap !== 'jpeg' && cap !== 'png') {
        throw new Error(`Invalid --capture "${cap}". Expected "jpeg" or "png".`);
      }
      captureFormat = cap;
    } else if (arg === '--software-gl') {
      softwareGl = true;
    } else if ((arg === '-o' || arg === '--output') && args[i + 1]) {
      outputPath = args[++i];
    } else if (arg === '--preview') {
      preview = true;
    } else if (arg === '--port' && args[i + 1]) {
      port = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      sceneInput = arg;
    }
    i++;
  }

  const dimensions = RESOLUTION_PRESETS[resPreset] ?? RESOLUTION_PRESETS['1080p'];
  const width = customWidth ?? dimensions.width;
  const height = customHeight ?? dimensions.height;

  if (!outputPath) {
    outputPath = resolveDefaultOutputPath(sceneInput, cameraMode, format);
  } else if (format !== 'sequence') {
    const endsWithSlash = outputPath.endsWith('/') || outputPath.endsWith('\\');
    const isExistingDir =
      fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory();
    if (endsWithSlash || isExistingDir) {
      outputPath = resolveDefaultOutputPath(sceneInput, cameraMode, format, outputPath);
    }
  }

  if (audioPath) {
    const resolvedAudio = path.resolve(audioPath);
    if (!fs.existsSync(resolvedAudio)) {
      throw new Error(`Audio file not found: "${audioPath}"`);
    }
    audioPath = resolvedAudio;
  }

  const customPose =
    presetName && CAMERA_PRESETS[presetName]
      ? CAMERA_PRESETS[presetName]
      : undefined;

  return {
    sceneInput,
    cameraMode,
    preset: presetName as CliOptions['preset'],
    customPose,
    labels,
    guides,
    hud,
    dofBlur,
    theme,
    fps,
    width,
    height,
    startSec,
    endSec,
    shotId,
    audioPath,
    stageSkinPath,
    entitySkinPaths,
    skinsDir,
    workers,
    captureFormat,
    softwareGl,
    format,
    outputPath,
    preview,
    port,
  };
}
