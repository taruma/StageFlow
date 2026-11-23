/**
 * FFmpeg pipe encoder streaming raw PNG frames into high-quality video files.
 */

import { spawn, execSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface FfmpegEncoderOptions {
  outputPath: string;
  fps: number;
  width: number;
  height: number;
  format: 'mp4' | 'webm' | 'gif' | 'sequence';
  inputCodec?: 'png' | 'mjpeg';
  startFrameIndex?: number;
  audioPath?: string;
  startSec?: number;
  durationSec?: number;
}

export interface FfmpegPipeline {
  writeFrame: (buffer: Buffer) => Promise<void>;
  close: () => Promise<void>;
}

export function resolveFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  // Prefer system ffmpeg (e.g. Gyan full build with libx264)
  const systemCandidates = [
    'ffmpeg',
    'ffmpeg.exe',
  ];
  for (const cmd of systemCandidates) {
    try {
      const test = execSync(`${cmd} -version`, { stdio: 'pipe' }).toString();
      if (test.includes('ffmpeg version')) {
        return cmd;
      }
    } catch {
      // Continue searching
    }
  }

  // Check user winget Gyan FFmpeg installation
  const userProfile = process.env.USERPROFILE || '';
  const gyanPath = path.join(
    userProfile,
    'AppData',
    'Local',
    'Microsoft',
    'WinGet',
    'Packages',
    'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe'
  );
  if (fs.existsSync(gyanPath)) {
    const entries = fs.readdirSync(gyanPath);
    for (const entry of entries) {
      const binExe = path.join(gyanPath, entry, 'bin', 'ffmpeg.exe');
      if (fs.existsSync(binExe)) {
        return binExe;
      }
    }
  }

  // Fallback to Playwright bundled ffmpeg (webm/png only)
  const pwFfmpeg = path.join(
    userProfile,
    'AppData',
    'Local',
    'ms-playwright',
    'ffmpeg-1013',
    'ffmpeg-win64.exe'
  );
  if (fs.existsSync(pwFfmpeg)) {
    return pwFfmpeg;
  }

  return 'ffmpeg';
}

export function createFfmpegPipeline(
  options: FfmpegEncoderOptions
): FfmpegPipeline {
  const { outputPath, fps, format } = options;

  // Ensure output directory exists
  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Sequence format: direct file writer without ffmpeg
  if (format === 'sequence') {
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    let frameNum = options.startFrameIndex ?? 0;
    const ext = options.inputCodec === 'mjpeg' ? 'jpg' : 'png';
    return {
      writeFrame: async (buffer: Buffer) => {
        const padded = String(frameNum++).padStart(5, '0');
        const frameFile = path.join(outputPath, `frame_${padded}.${ext}`);
        await fs.promises.writeFile(frameFile, buffer);
      },
      close: async () => {},
    };
  }

  const hasAudio = Boolean(options.audioPath && fs.existsSync(options.audioPath));
  const ffmpegExe = resolveFfmpegPath();
  const inputVcodec = options.inputCodec ?? 'png';
  const args = ['-y', '-f', 'image2pipe', '-vcodec', inputVcodec, '-r', String(fps), '-i', '-'];

  if (hasAudio && options.audioPath) {
    if (typeof options.startSec === 'number' && options.startSec > 0) {
      args.push('-ss', options.startSec.toFixed(3));
    }
    args.push('-i', options.audioPath);
  }

  if (format === 'mp4') {
    if (hasAudio) {
      args.push('-map', '0:v:0', '-map', '1:a:0?');
    }
    args.push(
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'medium',
      '-crf',
      '18'
    );
    if (hasAudio) {
      args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    }
    args.push(
      '-movflags',
      '+faststart',
      outputPath
    );
  } else if (format === 'webm') {
    if (hasAudio) {
      args.push('-map', '0:v:0', '-map', '1:a:0?');
    }
    args.push('-c:v', 'libvpx-vp9', '-crf', '24', '-b:v', '0');
    if (hasAudio) {
      args.push('-c:a', 'libopus', '-b:a', '128k', '-shortest');
    }
    args.push(outputPath);
  } else if (format === 'gif') {
    args.push(
      '-filter_complex',
      `[0:v] fps=${fps},split [a][b];[a] palettegen [p];[b][p] paletteuse`,
      outputPath
    );
  }

  const child: ChildProcess = spawn(ffmpegExe, args, {
    stdio: ['pipe', 'ignore', 'pipe'],
  });

  let stderrLogs = '';
  child.stderr?.on('data', (chunk) => {
    stderrLogs += chunk.toString();
  });

  return {
    writeFrame: (buffer: Buffer): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!child.stdin || child.stdin.destroyed) {
          return reject(
            new Error(`FFmpeg stdin closed prematurely.\nLogs:\n${stderrLogs.slice(-1000)}`)
          );
        }
        const canWriteMore = child.stdin.write(buffer);
        if (canWriteMore) {
          resolve();
        } else {
          child.stdin.once('drain', resolve);
        }
      });
    },
    close: (): Promise<void> => {
      return new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new Error(
                `FFmpeg exited with code ${code}.\nLogs:\n${stderrLogs.slice(-1000)}`
              )
            );
          }
        });
        child.on('error', (err) => {
          reject(err);
        });
        child.stdin?.end();
      });
    },
  };
}

export function concatMediaSegments(options: {
  segmentPaths: string[];
  outputPath: string;
  format: 'mp4' | 'webm';
  audioPath?: string;
  startSec?: number;
}): Promise<void> {
  const { segmentPaths, outputPath, format, audioPath, startSec } = options;
  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const concatListPath = path.join(
    path.dirname(path.resolve(segmentPaths[0])),
    'concat_segments.txt'
  );
  const listContent = segmentPaths
    .map(
      (p) =>
        `file '${path.resolve(p).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`
    )
    .join('\n');
  fs.writeFileSync(concatListPath, listContent, 'utf-8');

  const hasAudio = Boolean(audioPath && fs.existsSync(audioPath));
  const ffmpegExe = resolveFfmpegPath();
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath];

  if (hasAudio && audioPath) {
    if (typeof startSec === 'number' && startSec > 0) {
      args.push('-ss', startSec.toFixed(3));
    }
    args.push('-i', audioPath, '-map', '0:v:0', '-map', '1:a:0?');
  }

  args.push('-c:v', 'copy');

  if (hasAudio) {
    if (format === 'mp4') {
      args.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
    } else {
      args.push('-c:a', 'libopus', '-b:a', '128k', '-shortest');
    }
  }

  if (format === 'mp4') {
    args.push('-movflags', '+faststart');
  }

  args.push(outputPath);

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegExe, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderrLogs = '';
    child.stderr?.on('data', (chunk) => {
      stderrLogs += chunk.toString();
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg segment concat exited with code ${code}\nLogs:\n${stderrLogs.slice(-1000)}`
          )
        );
      }
    });
    child.on('error', reject);
  });
}
