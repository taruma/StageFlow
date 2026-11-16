/**
 * Pure 2D Canvas compositor for optional Storyboard single-frame export burn-ins.
 * Draws active composition guides (Rule of Thirds, 90% Safe Action, Crosshair)
 * and top-corner Slate Stamps (#Shot + Beat + Timecode) scaled cleanly to 720p/1080p.
 */

import type { StoryboardBeatTag, StoryboardGuideMode } from '../core/storyboardMath';

export interface StoryboardOverlayBurnInOptions {
  guideMode: StoryboardGuideMode;
  includeSlate: boolean;
  shotNumber: number;
  beatTag: StoryboardBeatTag;
  stageTimeSec: number;
  startSec: number;
  endSec: number;
}

const BEAT_DOT_COLOR: Record<'START' | 'MID' | 'END', string> = {
  START: '#34d399',
  MID: '#38bdf8',
  END: '#fbbf24',
};

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function drawSlateBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  dotColor: string | null,
  fontPx: number,
  padX: number,
  padY: number,
  radius: number,
  alignRight = false
): void {
  ctx.save();
  ctx.font = `700 ${fontPx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const dotSize = dotColor ? Math.round(fontPx * 0.55) : 0;
  const dotGap = dotColor ? Math.round(fontPx * 0.5) : 0;
  const boxW = Math.ceil(metrics.width + padX * 2 + dotSize + dotGap);
  const boxH = Math.ceil(fontPx + padY * 2);
  const drawX = alignRight ? x - boxW : x;

  drawRoundRect(ctx, drawX, y, boxW, boxH, radius);
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = Math.max(1, fontPx * 0.08);
  ctx.stroke();

  let textX = drawX + padX;
  const centerY = y + boxH / 2;

  if (dotColor) {
    ctx.beginPath();
    ctx.arc(textX + dotSize / 2, centerY, dotSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    textX += dotSize + dotGap;
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.fillText(text, textX, centerY + 0.5);
  ctx.restore();
}

/**
 * Composites active guides and/or slate corner stamps onto a copy of `sourceCanvas`.
 */
export function renderStoryboardOverlayBurnIn(
  sourceCanvas: HTMLCanvasElement,
  options: StoryboardOverlayBurnInOptions
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;

  const ctx = out.getContext('2d');
  if (!ctx) {
    return sourceCanvas;
  }

  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  const scale = Math.max(0.5, Math.min(width, height) / 720);

  // 1. Composition Guides
  if (options.guideMode !== 'off') {
    const showThirds =
      options.guideMode === 'thirds' || options.guideMode === 'all';
    const showSafe =
      options.guideMode === 'safe' || options.guideMode === 'all';
    const showCrosshair = options.guideMode === 'all';

    ctx.save();
    if (showSafe) {
      const mx = width * 0.05;
      const my = height * 0.05;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.setLineDash([8 * scale, 6 * scale]);
      ctx.strokeRect(mx, my, width - mx * 2, height - my * 2);
      ctx.setLineDash([]);
    }

    if (showThirds) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.48)';
      ctx.lineWidth = Math.max(1, 1.2 * scale);
      ctx.beginPath();
      for (const frac of [1 / 3, 2 / 3]) {
        const x = Math.round(width * frac) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        const y = Math.round(height * frac) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    if (showCrosshair || showSafe) {
      const cx = width / 2;
      const cy = height / 2;
      const r = 10 * scale;
      const tick = 6 * scale;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.78)';
      ctx.lineWidth = Math.max(1, 1.5 * scale);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.moveTo(cx, cy - r - tick);
      ctx.lineTo(cx, cy - r);
      ctx.moveTo(cx, cy + r);
      ctx.lineTo(cx, cy + r + tick);
      ctx.moveTo(cx - r - tick, cy);
      ctx.lineTo(cx - r, cy);
      ctx.moveTo(cx + r, cy);
      ctx.lineTo(cx + r + tick, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 2.2 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. Slate Corner Stamps
  if (options.includeSlate) {
    const margin = Math.round(16 * scale);
    const fontPx = Math.round(15 * scale);
    const padX = Math.round(9 * scale);
    const padY = Math.round(5 * scale);
    const radius = Math.round(5 * scale);

    const shotBadge = `#${String(options.shotNumber).padStart(2, '0')}`;
    const leftText = options.beatTag
      ? `${shotBadge} · ${options.beatTag}`
      : shotBadge;
    const dotColor = options.beatTag ? BEAT_DOT_COLOR[options.beatTag] : null;
    drawSlateBadge(
      ctx,
      margin,
      margin,
      leftText,
      dotColor,
      fontPx,
      padX,
      padY,
      radius,
      false
    );

    const durSec = Math.max(0, options.endSec - options.startSec);
    const rightText = options.beatTag
      ? `@ ${options.stageTimeSec.toFixed(1)}s`
      : `${options.startSec.toFixed(1)}s–${options.endSec.toFixed(1)}s (${durSec.toFixed(1)}s)`;
    drawSlateBadge(
      ctx,
      width - margin,
      margin,
      rightText,
      null,
      fontPx,
      padX,
      padY,
      radius,
      true
    );
  }

  return out;
}
