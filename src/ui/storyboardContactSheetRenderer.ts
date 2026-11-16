/**
 * Clean White-Paper Storyboard Contact Sheet 2D Canvas Renderer (Phase 2b).
 * Composites the header, Lenses/Moves/Rigs summary, grouped shot cards
 * (respecting Density columns, Start&End / Start·Mid·End grouping, Portrait
 * horizontal splits, Guides, and Annotated vs Clean Only) onto an offscreen
 * high-resolution PNG canvas regardless of the active app Dark/Warm/Light theme.
 */

import type { ExportTargetCamera } from '../core/exportMath';
import {
  formatScoreVideoSourceLabel,
  formatStoryboardShotMeta,
  paginateStoryboardRows,
  type StoryboardGuideMode,
  type StoryboardLayoutSpec,
  type StoryboardSamplePoint,
  type StoryboardSheetSummary,
  type StoryboardShotGroup,
} from '../core/storyboardMath';
import type { StageScore } from '../core/types';
import type { StoryboardRenderedPanel } from '../hooks/useStoryboardGenerator';
import type { StoryboardCardLayoutMode } from './StoryboardPanelCard';
import { drawStoryboardOverlayInRect } from './storyboardOverlayBurnIn';

export interface RenderStoryboardContactSheetParams {
  score: StageScore;
  shotGroups: StoryboardShotGroup[];
  panelsByKey: Map<string, StoryboardRenderedPanel>;
  sheetSummary: StoryboardSheetSummary;
  gateLabel: string;
  panelWidth: number;
  panelHeight: number;
  targetCamera: ExportTargetCamera;
  layoutSpec: StoryboardLayoutSpec;
  layoutMode: StoryboardCardLayoutMode;
  annotated: boolean;
  guideMode: StoryboardGuideMode;
  totalCount: number;
}

const SHEET_LOGICAL_WIDTH = 2400;
const PAGE_HEIGHT_BUDGET = 3200;
const SHEET_PAD = 56;
const GRID_GAP = 28;
const MAX_CANVAS_DIM = 15000;

const PALETTE = {
  paperBg: '#ffffff',
  cardBg: '#ffffff',
  cardBorder: '#cbd5e1',
  subtleBorder: '#e2e8f0',
  tileBayBg: '#f8fafc',
  textMain: '#0f172a',
  textBody: '#334155',
  textMuted: '#475569',
  textFaint: '#64748b',
} as const;

const SANS_FONT =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

interface CardLayoutBox {
  group: StoryboardShotGroup;
  colSpan: number;
  x: number;
  y: number;
  width: number;
  height: number;
  meta: ReturnType<typeof formatStoryboardShotMeta>;
  specRows: Array<{ label: string; value: string; spanFull?: boolean }>;
  noteLines: string[];
  isHorizontalSplit: boolean;
  isPortraitHorizontalCard: boolean;
  isLandscapeHorizontalStaticRow: boolean;
  isStartEndPair: boolean;
  isTripleStrip: boolean;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode preview panel image.'));
    img.src = url;
  });
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + ellipsis).width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo > 0 ? text.slice(0, lo) + ellipsis : ellipsis;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = Number.POSITIVE_INFINITY
): string[] {
  if (!text.trim() || maxWidth <= 0 || maxLines <= 0) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) {
        const remaining = [words[i], ...words.slice(i + 1)].join(' ');
        lines[maxLines - 1] = truncateText(
          ctx,
          `${lines[maxLines - 1]} ${remaining}`,
          maxWidth
        );
        return lines;
      }
      current = words[i];
    } else {
      lines.push(truncateText(ctx, words[i], maxWidth));
      if (lines.length >= maxLines) return lines;
      current = '';
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function drawRoundedRectPath(
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

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  const srcRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const dstRatio = dw / Math.max(1, dh);
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;

  if (srcRatio > dstRatio) {
    sw = img.naturalHeight * dstRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else if (srcRatio < dstRatio) {
    sh = img.naturalWidth / dstRatio;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function computeTileRectsForCard(
  box: CardLayoutBox,
  panelAspect: number
): Array<{ sample: StoryboardSamplePoint; x: number; y: number; w: number; h: number; rounded: boolean }> {
  const { group, x, y, width, height } = box;
  const samples = group.samples;
  const pad = 16;

  if (box.isPortraitHorizontalCard) {
    if (box.isTripleStrip) {
      const tileW = Math.min(200, Math.round(width * 0.165));
      const tileH = Math.round(tileW / panelAspect);
      const bayTop = y + Math.max(pad, Math.round((height - tileH) / 2));
      return samples.map((sample, idx) => ({
        sample,
        x: x + pad + idx * (tileW + 12),
        y: bayTop,
        w: tileW,
        h: tileH,
        rounded: true,
      }));
    }
    if (box.isStartEndPair) {
      const tileW = Math.min(210, Math.round(width * 0.19));
      const tileH = Math.round(tileW / panelAspect);
      const bayTop = y + Math.max(pad, Math.round((height - tileH) / 2));
      return samples.map((sample, idx) => ({
        sample,
        x: x + pad + idx * (tileW + 12),
        y: bayTop,
        w: tileW,
        h: tileH,
        rounded: true,
      }));
    }
    const tileW = Math.min(250, Math.round(width * 0.34));
    const tileH = Math.round(tileW / panelAspect);
    const bayTop = y + Math.max(pad, Math.round((height - tileH) / 2));
    return [
      {
        sample: samples[0],
        x: x + pad,
        y: bayTop,
        w: tileW,
        h: tileH,
        rounded: true,
      },
    ];
  }

  if (box.isLandscapeHorizontalStaticRow) {
    const bayW = Math.round(width / 3);
    const tileW = bayW - pad * 2;
    const tileH = Math.round(tileW / panelAspect);
    const bayTop = y + Math.max(pad, Math.round((height - tileH) / 2));
    return [
      {
        sample: samples[0],
        x: x + pad,
        y: bayTop,
        w: tileW,
        h: tileH,
        rounded: true,
      },
    ];
  }

  if (box.isTripleStrip) {
    const innerGap = 14;
    const tileW = Math.round((width - pad * 2 - innerGap * (samples.length - 1)) / samples.length);
    const tileH = Math.round(tileW / panelAspect);
    return samples.map((sample, idx) => ({
      sample,
      x: x + pad + idx * (tileW + innerGap),
      y: y + pad,
      w: tileW,
      h: tileH,
      rounded: true,
    }));
  }

  if (box.isStartEndPair) {
    const bayPad = 14;
    const innerGap = 12;
    const tileW = Math.round((width - bayPad * 2 - innerGap) / 2);
    const tileH = Math.round(tileW / panelAspect);
    return samples.map((sample, idx) => ({
      sample,
      x: x + bayPad + idx * (tileW + innerGap),
      y: y + bayPad,
      w: tileW,
      h: tileH,
      rounded: true,
    }));
  }

  return [
    {
      sample: samples[0],
      x,
      y,
      w: width,
      h: Math.round(width / panelAspect),
      rounded: false,
    },
  ];
}

function buildSpecRows(
  meta: ReturnType<typeof formatStoryboardShotMeta>
): Array<{ label: string; value: string; spanFull?: boolean }> {
  return [
    { label: 'TARGET', value: meta.targetText, spanFull: !meta.rigText },
    ...(meta.rigText ? [{ label: 'RIG', value: meta.rigText }] : []),
    { label: 'CAM', value: meta.cameraText },
    { label: 'MOVE', value: meta.moveText },
    { label: 'OPTICS', value: meta.opticsText, spanFull: !meta.focusText },
    ...(meta.focusText ? [{ label: 'FOCUS', value: meta.focusText }] : []),
    ...(meta.observerText
      ? [{ label: 'OBS', value: meta.observerText, spanFull: true }]
      : []),
  ];
}

function drawContactSheetCard(
  ctx: CanvasRenderingContext2D,
  box: CardLayoutBox,
  loadedImages: Map<string, HTMLImageElement>,
  panelAspect: number,
  annotated: boolean,
  guideMode: StoryboardGuideMode
): void {
  const radius = 14;
  ctx.save();
  drawRoundedRectPath(ctx, box.x, box.y, box.width, box.height, radius);
  ctx.fillStyle = PALETTE.cardBg;
  ctx.fill();
  ctx.clip();

  const tiles = computeTileRectsForCard(box, panelAspect);

  // Subtle bay fill behind multi-tile / portrait frame areas
  if (
    box.isPortraitHorizontalCard ||
    box.isLandscapeHorizontalStaticRow ||
    box.isTripleStrip ||
    box.isStartEndPair
  ) {
    const maxX = tiles.reduce((m, t) => Math.max(m, t.x + t.w), box.x);
    const bayW = box.isHorizontalSplit ? maxX - box.x + 16 : box.width;
    const bayH = box.isHorizontalSplit
      ? box.height
      : (tiles[0]?.h ?? 0) + (box.isStartEndPair ? 28 : 32);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(box.x, box.y, bayW, bayH);
  }

  // Draw frame tiles + optional slate stamps & composition guides
  for (const tile of tiles) {
    ctx.save();
    if (tile.rounded) {
      drawRoundedRectPath(ctx, tile.x, tile.y, tile.w, tile.h, 8);
    } else {
      ctx.beginPath();
      ctx.rect(tile.x, tile.y, tile.w, tile.h);
    }
    ctx.clip();

    ctx.fillStyle = PALETTE.tileBayBg;
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);

    const img = loadedImages.get(tile.sample.key);
    if (img) {
      drawImageCover(ctx, img, tile.x, tile.y, tile.w, tile.h);
    }

    if (annotated || guideMode !== 'off') {
      drawStoryboardOverlayInRect(
        ctx,
        { x: tile.x, y: tile.y, width: tile.w, height: tile.h },
        {
          guideMode,
          includeSlate: annotated,
          shotNumber: tile.sample.shot.shotNumber,
          beatTag: tile.sample.beatTag,
          stageTimeSec: tile.sample.stageTimeSec,
          startSec: tile.sample.shot.startSec,
          endSec: tile.sample.shot.endSec,
        },
        320
      );
    }
    ctx.restore();

    if (tile.rounded) {
      drawRoundedRectPath(ctx, tile.x, tile.y, tile.w, tile.h, 8);
      ctx.strokeStyle = PALETTE.subtleBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // Annotated technical footer/right-pane
  if (annotated) {
    const bayMaxX = tiles.reduce((m, t) => Math.max(m, t.x + t.w), box.x) + 16;
    const bayMaxY =
      (tiles[0]?.y ?? box.y) +
      (tiles[0]?.h ?? 0) +
      (box.isStartEndPair ? 14 : box.isTripleStrip ? 16 : 0);

    const metaX = box.isHorizontalSplit ? bayMaxX : box.x;
    const metaY = box.isHorizontalSplit ? box.y : bayMaxY;
    const metaW = box.isHorizontalSplit ? box.x + box.width - metaX : box.width;
    const padX = box.isHorizontalSplit ? 24 : 20;

    ctx.strokeStyle = PALETTE.subtleBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (box.isHorizontalSplit) {
      ctx.moveTo(metaX, metaY);
      ctx.lineTo(metaX, box.y + box.height);
    } else {
      ctx.moveTo(metaX, metaY);
      ctx.lineTo(metaX + metaW, metaY);
    }
    ctx.stroke();

    let curY = metaY + 20;
    const innerW = metaW - padX * 2;

    // Title + optional multi-beat shot timecode
    const timeStamp = `${box.meta.timeRangeText} (${box.meta.durationText})`;
    let titleMaxW = innerW;
    if (box.group.samples.length > 1) {
      ctx.font = `400 16px ${MONO_FONT}`;
      const tsWidth = ctx.measureText(timeStamp).width;
      titleMaxW = Math.max(60, innerW - tsWidth - 16);
      ctx.fillStyle = PALETTE.textFaint;
      ctx.textAlign = 'right';
      ctx.fillText(timeStamp, metaX + metaW - padX, curY + 2);
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = PALETTE.textMain;
    ctx.font = `700 20px ${SANS_FONT}`;
    ctx.fillText(
      truncateText(ctx, box.meta.label, titleMaxW),
      metaX + padX,
      curY
    );
    curY += 34;

    // Top hairline above spec table
    ctx.strokeStyle = PALETTE.subtleBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(metaX + padX, curY);
    ctx.lineTo(metaX + metaW - padX, curY);
    ctx.stroke();
    curY += 12;

    // 2-Column Technical Spec Table
    const colGap = 16;
    const cellW = (innerW - colGap) / 2;
    let cellCol = 0;

    for (const spec of box.specRows) {
      if (spec.spanFull && cellCol === 1) {
        curY += 26;
        cellCol = 0;
      }
      const cellX = metaX + padX + cellCol * (cellW + colGap);
      const availW = spec.spanFull ? innerW : cellW;

      ctx.fillStyle = PALETTE.textFaint;
      ctx.font = `600 13px ${MONO_FONT}`;
      ctx.fillText(spec.label, cellX, curY + 2);

      const valX = cellX + 60;
      ctx.fillStyle = PALETTE.textBody;
      ctx.font = `500 16px ${MONO_FONT}`;
      ctx.fillText(
        truncateText(ctx, spec.value, Math.max(20, availW - 60)),
        valX,
        curY
      );

      if (spec.spanFull) {
        curY += 26;
        cellCol = 0;
      } else if (cellCol === 1) {
        curY += 26;
        cellCol = 0;
      } else {
        cellCol = 1;
      }
    }
    if (cellCol === 1) {
      curY += 26;
    }

    curY += 4;
    ctx.beginPath();
    ctx.moveTo(metaX + padX, curY);
    ctx.lineTo(metaX + metaW - padX, curY);
    ctx.stroke();

    if (box.noteLines.length > 0) {
      curY += 14;
      ctx.fillStyle = PALETTE.textMuted;
      ctx.font = `400 18px ${SANS_FONT}`;
      for (const line of box.noteLines) {
        ctx.fillText(line, metaX + padX, curY);
        curY += 24;
      }
    }
  }

  ctx.restore();

  // Outer card border
  drawRoundedRectPath(ctx, box.x, box.y, box.width, box.height, radius);
  ctx.strokeStyle = PALETTE.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export interface RenderStoryboardContactSheetOptions {
  singlePage?: boolean;
}

export type PlanContactSheetLayoutParams = Omit<
  RenderStoryboardContactSheetParams,
  'panelsByKey' | 'gateLabel' | 'totalCount' | 'guideMode'
>;

let cachedMeasureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (!cachedMeasureCtx) {
    const canvas = document.createElement('canvas');
    cachedMeasureCtx = canvas.getContext('2d');
  }
  if (!cachedMeasureCtx) {
    throw new Error('2D canvas context unavailable for Contact Sheet layout.');
  }
  return cachedMeasureCtx;
}

function planContactSheetLayout(
  params: PlanContactSheetLayoutParams,
  singlePage = false
) {
  const {
    score,
    shotGroups,
    sheetSummary,
    panelWidth,
    panelHeight,
    targetCamera,
    layoutSpec,
    layoutMode,
    annotated,
  } = params;

  const mctx = getMeasureContext();
  const innerWidth = SHEET_LOGICAL_WIDTH - SHEET_PAD * 2;
  const cols = layoutSpec.columns;
  const colUnitWidth = (innerWidth - GRID_GAP * (cols - 1)) / cols;
  const panelAspect = panelWidth / Math.max(1, panelHeight);

  const summaryParts: Array<{ title: string; value: string }> = [];
  if (sheetSummary.lenses.length > 0) {
    summaryParts.push({
      title: 'LENSES',
      value: sheetSummary.lenses.map((i) => `${i.label} ×${i.count}`).join(' · '),
    });
  }
  if (sheetSummary.maneuvers.length > 0) {
    summaryParts.push({
      title: 'MOVES',
      value: sheetSummary.maneuvers.map((i) => `${i.label} ×${i.count}`).join(' · '),
    });
  }
  if (sheetSummary.rigs.length > 0) {
    summaryParts.push({
      title: 'RIGS',
      value: sheetSummary.rigs.map((i) => `${i.label} ×${i.count}`).join(' · '),
    });
  }

  // Pack cards into visual rows (with y=0 relative to row top)
  const rows: Array<{ height: number; boxes: CardLayoutBox[] }> = [];
  let rowGroups: Array<{ group: StoryboardShotGroup; colSpan: number; colStart: number }> = [];
  let colCursor = 0;

  const flushRow = () => {
    if (rowGroups.length === 0) return;

    const rowBoxes: CardLayoutBox[] = rowGroups.map(({ group, colSpan, colStart }) => {
      const w = colUnitWidth * colSpan + GRID_GAP * (colSpan - 1);
      const x = SHEET_PAD + colStart * (colUnitWidth + GRID_GAP);
      const frameCount = group.samples.length;
      const isStartEndPair = layoutMode === 'start-end' && frameCount === 2;
      const isTripleStrip = layoutMode === 'single-row' && frameCount >= 3;
      const isPortraitHorizontalCard = layoutSpec.isPortrait && annotated;
      const isLandscapeHorizontalStaticRow =
        !layoutSpec.isPortrait && layoutMode === 'single-row' && frameCount === 1;
      const isHorizontalSplit =
        isPortraitHorizontalCard || isLandscapeHorizontalStaticRow;

      const meta = formatStoryboardShotMeta(
        group.samples,
        targetCamera,
        score.observerShots
      );
      const specRows = annotated ? buildSpecRows(meta) : [];

      let mediaWidth = w;
      let mediaHeight = 0;
      if (isPortraitHorizontalCard) {
        const tempBox: CardLayoutBox = {
          group,
          colSpan,
          x,
          y: 0,
          width: w,
          height: 0,
          meta,
          specRows,
          noteLines: [],
          isHorizontalSplit,
          isPortraitHorizontalCard,
          isLandscapeHorizontalStaticRow,
          isStartEndPair,
          isTripleStrip,
        };
        const tiles = computeTileRectsForCard(tempBox, panelAspect);
        const tileH = tiles[0]?.h ?? Math.round(200 / panelAspect);
        const rightMost = tiles.reduce((m, t) => Math.max(m, t.x - x + t.w), 0);
        mediaWidth = rightMost + 16;
        mediaHeight = tileH + 32;
      } else if (isLandscapeHorizontalStaticRow) {
        const bayW = Math.round(w / 3);
        const tileW = bayW - 32;
        const tileH = Math.round(tileW / panelAspect);
        mediaWidth = bayW;
        mediaHeight = tileH + 32;
      } else if (isTripleStrip) {
        const tileW = Math.round((w - 32 - 14 * (frameCount - 1)) / frameCount);
        mediaHeight = Math.round(tileW / panelAspect) + 32;
      } else if (isStartEndPair) {
        const tileW = Math.round((w - 28 - 12) / 2);
        mediaHeight = Math.round(tileW / panelAspect) + 28;
      } else {
        mediaHeight = Math.round(w / panelAspect);
      }

      const metaWidth = isHorizontalSplit ? w - mediaWidth : w;
      const metaPadX = isHorizontalSplit ? 24 : 20;
      mctx.font = `400 18px ${SANS_FONT}`;
      const noteLines =
        annotated && meta.description
          ? wrapTextLines(mctx, meta.description, metaWidth - metaPadX * 2)
          : [];

      let metaHeight = 0;
      if (annotated) {
        const specRowCount = specRows.reduce(
          (acc, item) => acc + (item.spanFull ? 2 : 1),
          0
        );
        const specGridRows = Math.ceil(specRowCount / 2);
        const titleBlockH = 38;
        const specBlockH = 22 + specGridRows * 26;
        const notesBlockH = noteLines.length > 0 ? 14 + noteLines.length * 24 : 0;
        metaHeight = 20 + titleBlockH + specBlockH + notesBlockH + 20;
      }

      const cardHeight = isHorizontalSplit
        ? Math.max(mediaHeight, metaHeight)
        : mediaHeight + metaHeight;

      return {
        group,
        colSpan,
        x,
        y: 0,
        width: w,
        height: cardHeight,
        meta,
        specRows,
        noteLines,
        isHorizontalSplit,
        isPortraitHorizontalCard,
        isLandscapeHorizontalStaticRow,
        isStartEndPair,
        isTripleStrip,
      };
    });

    const rowHeight = rowBoxes.reduce((m, b) => Math.max(m, b.height), 0);
    for (const box of rowBoxes) {
      box.height = rowHeight;
    }
    rows.push({ height: rowHeight, boxes: rowBoxes });

    rowGroups = [];
    colCursor = 0;
  };

  for (const group of shotGroups) {
    const isStartEndPair = layoutMode === 'start-end' && group.samples.length === 2;
    const colSpan =
      layoutMode === 'single-row'
        ? cols
        : isStartEndPair
          ? Math.min(2, cols)
          : 1;

    if (colCursor + colSpan > cols) {
      flushRow();
    }
    rowGroups.push({ group, colSpan, colStart: colCursor });
    colCursor += colSpan;
  }
  flushRow();

  mctx.font = `400 19px ${SANS_FONT}`;
  const subtitleLines = score.subtitle?.trim()
    ? wrapTextLines(mctx, score.subtitle.trim(), innerWidth * 0.72)
    : [];
  const videoSource = formatScoreVideoSourceLabel(score.videoUrl);

  let headerOffsetY = 66;
  if (subtitleLines.length > 0) {
    headerOffsetY += 4 + subtitleLines.length * 26;
  }
  if (videoSource.label) {
    headerOffsetY += 6 + 22;
  }
  const summaryTopOffsetY = headerOffsetY + 14;
  if (summaryParts.length > 0) {
    headerOffsetY = summaryTopOffsetY + 26;
  }

  const firstHeaderH = Math.max(112, headerOffsetY + 14);
  const firstGapAfterHeader = 32;
  const contHeaderH = 68;
  const contGapAfterHeader = 28;

  const firstPageBudget =
    PAGE_HEIGHT_BUDGET - (SHEET_PAD * 2 + firstHeaderH + firstGapAfterHeader);
  const contPageBudget =
    PAGE_HEIGHT_BUDGET - (SHEET_PAD * 2 + contHeaderH + contGapAfterHeader);

  const pageRowIndices = singlePage
    ? [rows.map((_, idx) => idx)]
    : paginateStoryboardRows(
        rows.map((r) => r.height),
        firstPageBudget,
        contPageBudget,
        GRID_GAP
      );

  return {
    innerWidth,
    panelAspect,
    subtitleLines,
    videoSourceLabel: videoSource.label,
    summaryTopOffsetY,
    summaryParts,
    rows,
    firstHeaderH,
    firstGapAfterHeader,
    contHeaderH,
    contGapAfterHeader,
    pageRowIndices,
  };
}

/**
 * Computes how many pages the current Contact Sheet layout will span when paginated.
 */
export function estimateStoryboardContactSheetPageCount(
  params: PlanContactSheetLayoutParams
): number {
  if (params.shotGroups.length === 0) return 1;
  return planContactSheetLayout(params, false).pageRowIndices.length;
}

/**
 * Composites the clean white-paper Storyboard Contact Sheet across one or more
 * balanced pages (~3200px tall at 2400px wide), or onto 1 continuous page when
 * `options.singlePage` is true.
 */
export async function renderStoryboardContactSheetPages(
  params: RenderStoryboardContactSheetParams,
  options: RenderStoryboardContactSheetOptions = {}
): Promise<HTMLCanvasElement[]> {
  const {
    score,
    shotGroups,
    panelsByKey,
    gateLabel,
    panelWidth,
    panelHeight,
    targetCamera,
    guideMode,
    annotated,
    totalCount,
  } = params;

  // Decode all ready panel images in parallel
  const loadedImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    shotGroups.flatMap((group) =>
      group.samples.map(async (sample) => {
        const panel = panelsByKey.get(sample.key);
        if (panel) {
          loadedImages.set(sample.key, await loadImage(panel.imageUrl));
        }
      })
    )
  );

  const {
    innerWidth,
    panelAspect,
    subtitleLines,
    videoSourceLabel,
    summaryTopOffsetY,
    summaryParts,
    rows,
    firstHeaderH,
    firstGapAfterHeader,
    contHeaderH,
    contGapAfterHeader,
    pageRowIndices,
  } = planContactSheetLayout(params, options.singlePage ?? false);

  const totalPages = pageRowIndices.length;
  const camTitle =
    targetCamera === 'observer' ? 'Observer Diorama' : 'Stage Cam POV';

  const canvases: HTMLCanvasElement[] = [];

  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const rowIdxList = pageRowIndices[pIdx];
    const isFirstPage = pIdx === 0;
    const headerH = isFirstPage ? firstHeaderH : contHeaderH;
    const gapAfterHeader = isFirstPage ? firstGapAfterHeader : contGapAfterHeader;

    const rowsContentH = rowIdxList.reduce(
      (sum, rIdx, idx) => sum + rows[rIdx].height + (idx > 0 ? GRID_GAP : 0),
      0
    );
    const logicalHeight =
      rowIdxList.length === 0
        ? SHEET_PAD * 2 + headerH + gapAfterHeader + 140
        : SHEET_PAD * 2 + headerH + gapAfterHeader + rowsContentH;

    const scale = Math.min(1, MAX_CANVAS_DIM / Math.max(1, logicalHeight));
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = Math.round(SHEET_LOGICAL_WIDTH * scale);
    pageCanvas.height = Math.round(logicalHeight * scale);
    const ctx = pageCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to acquire 2D Contact Sheet canvas context.');
    }

    ctx.scale(scale, scale);

    // 1. Clean White Paper Background
    ctx.fillStyle = PALETTE.paperBg;
    ctx.fillRect(0, 0, SHEET_LOGICAL_WIDTH, logicalHeight);

    // 2. Page Header
    const headerY = SHEET_PAD;
    ctx.textBaseline = 'top';

    if (isFirstPage) {
      ctx.fillStyle = PALETTE.textFaint;
      ctx.font = `600 16px ${MONO_FONT}`;
      ctx.fillText('STORYBOARD CONTACT SHEET', SHEET_PAD, headerY);

      ctx.fillStyle = PALETTE.textMain;
      ctx.font = `700 34px ${SANS_FONT}`;
      ctx.fillText(
        truncateText(ctx, score.title, innerWidth * 0.62),
        SHEET_PAD,
        headerY + 26
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.textMuted;
      ctx.font = `500 18px ${MONO_FONT}`;
      ctx.fillText(
        `${shotGroups.length} ${shotGroups.length === 1 ? 'Shot' : 'Shots'} · ${totalCount} ${totalCount === 1 ? 'Frame' : 'Frames'} · ${camTitle}`,
        SHEET_LOGICAL_WIDTH - SHEET_PAD,
        headerY + 18
      );
      ctx.fillStyle = PALETTE.textFaint;
      ctx.font = `400 16px ${MONO_FONT}`;
      const pageSuffix = totalPages > 1 ? ` · Page 1 / ${totalPages}` : '';
      ctx.fillText(
        `${gateLabel} · ${panelWidth}×${panelHeight}${pageSuffix}`,
        SHEET_LOGICAL_WIDTH - SHEET_PAD,
        headerY + 46
      );
      ctx.textAlign = 'left';

      let blockY = headerY + 66;
      if (subtitleLines.length > 0) {
        blockY += 4;
        ctx.fillStyle = PALETTE.textMuted;
        ctx.font = `400 19px ${SANS_FONT}`;
        for (const line of subtitleLines) {
          ctx.fillText(line, SHEET_PAD, blockY);
          blockY += 26;
        }
      }

      if (videoSourceLabel) {
        blockY += 6;
        ctx.fillStyle = PALETTE.textFaint;
        ctx.font = `600 13px ${MONO_FONT}`;
        ctx.fillText('VIDEO', SHEET_PAD, blockY + 2);
        const labelW = ctx.measureText('VIDEO').width + 12;

        ctx.fillStyle = PALETTE.textBody;
        ctx.font = `400 15px ${MONO_FONT}`;
        ctx.fillText(
          truncateText(ctx, videoSourceLabel, Math.max(120, innerWidth - labelW)),
          SHEET_PAD + labelW,
          blockY
        );
      }

      if (summaryParts.length > 0) {
        let sx = SHEET_PAD;
        const sy = headerY + summaryTopOffsetY;
        for (let i = 0; i < summaryParts.length; i++) {
          if (i > 0) {
            ctx.fillStyle = PALETTE.cardBorder;
            ctx.font = `400 17px ${MONO_FONT}`;
            ctx.fillText('|', sx, sy);
            sx += ctx.measureText('|').width + 18;
          }
          ctx.fillStyle = PALETTE.textFaint;
          ctx.font = `600 14px ${MONO_FONT}`;
          ctx.fillText(summaryParts[i].title, sx, sy + 2);
          sx += ctx.measureText(summaryParts[i].title).width + 12;

          ctx.fillStyle = PALETTE.textBody;
          ctx.font = `500 17px ${MONO_FONT}`;
          const maxSummaryValW = Math.max(
            120,
            SHEET_LOGICAL_WIDTH - SHEET_PAD - sx
          );
          const valText = truncateText(
            ctx,
            summaryParts[i].value,
            maxSummaryValW
          );
          ctx.fillText(valText, sx, sy);
          sx += ctx.measureText(valText).width + 18;
        }
      }
    } else {
      ctx.fillStyle = PALETTE.textFaint;
      ctx.font = `600 15px ${MONO_FONT}`;
      ctx.fillText('STORYBOARD CONTACT SHEET', SHEET_PAD, headerY + 2);

      ctx.fillStyle = PALETTE.textMain;
      ctx.font = `700 24px ${SANS_FONT}`;
      ctx.fillText(
        truncateText(ctx, score.title, innerWidth * 0.62),
        SHEET_PAD,
        headerY + 24
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.textMuted;
      ctx.font = `600 18px ${MONO_FONT}`;
      ctx.fillText(
        `Page ${pIdx + 1} / ${totalPages}`,
        SHEET_LOGICAL_WIDTH - SHEET_PAD,
        headerY + 8
      );
      ctx.fillStyle = PALETTE.textFaint;
      ctx.font = `400 15px ${MONO_FONT}`;
      ctx.fillText(
        `${camTitle} · ${gateLabel}`,
        SHEET_LOGICAL_WIDTH - SHEET_PAD,
        headerY + 34
      );
      ctx.textAlign = 'left';
    }

    ctx.strokeStyle = PALETTE.subtleBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SHEET_PAD, SHEET_PAD + headerH);
    ctx.lineTo(SHEET_LOGICAL_WIDTH - SHEET_PAD, SHEET_PAD + headerH);
    ctx.stroke();

    // 3. Draw rows assigned to this page
    let cursorY = SHEET_PAD + headerH + gapAfterHeader;
    for (const rIdx of rowIdxList) {
      const row = rows[rIdx];
      for (const box of row.boxes) {
        box.y = cursorY;
        drawContactSheetCard(
          ctx,
          box,
          loadedImages,
          panelAspect,
          annotated,
          guideMode
        );
      }
      cursorY += row.height + GRID_GAP;
    }

    canvases.push(pageCanvas);
  }

  return canvases;
}
