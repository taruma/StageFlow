/**
 * Single-Page Playwright + CDP Screenshot Worker for Stateless Frame Sharding.
 */

import fs from 'node:fs';
import type { Browser } from 'playwright';
import type {
  RecorderConfig,
  RecorderFrameResult,
} from '../../src/recorder/recorderTypes';
import type { CaptureFormat } from './recorderTypes';
import type { FfmpegPipeline } from './ffmpegPipeline';
import type { ResolvedRecorderSkins } from './skinResolver';

export interface RunWorkerShardParams {
  browser: Browser;
  serverUrl: string;
  viewport: { width: number; height: number };
  recorderConfig: RecorderConfig;
  skins?: ResolvedRecorderSkins;
  captureFormat: CaptureFormat;
  startFrame: number;
  endFrame: number;
  pipeline: FfmpegPipeline;
  onInitInfo?: (info: {
    totalFrames: number;
    durationSec: number;
    rendererInfo?: string;
  }) => void;
  onFrameCaptured?: (result: RecorderFrameResult) => void;
}

export async function runWorkerShard({
  browser,
  serverUrl,
  viewport,
  recorderConfig,
  skins,
  captureFormat,
  startFrame,
  endFrame,
  pipeline,
  onInitInfo,
  onFrameCaptured,
}: RunWorkerShardParams): Promise<void> {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => {
    console.error('\n⚠️ Browser Page Error:', err.message);
  });
  page.on('crash', () => {
    console.error('\n❌ Browser Page Crashed!');
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log('[Browser error]:', text);
    }
  });

  const cdp = await context.newCDPSession(page);

  try {
    if (skins && skins.routeMap.size > 0) {
      await page.route('**/__stageflow_skin__/*', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const asset = skins.routeMap.get(pathname);
        if (!asset) {
          await route.abort();
          return;
        }
        const body = await fs.promises.readFile(asset.filePath);
        await route.fulfill({
          status: 200,
          contentType: asset.contentType,
          body,
        });
      });
    }

    const targetUrl = `${serverUrl}/?mode=headless-render`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => Boolean(window.__STAGEFLOW_RECORDER__?.ready),
      { timeout: 15000 }
    );

    const sessionInfo = await page.evaluate(
      (cfg) => window.__STAGEFLOW_RECORDER__!.init(cfg),
      recorderConfig
    );
    onInitInfo?.(sessionInfo);

    for (let i = startFrame; i < endFrame; i++) {
      let frameResult: RecorderFrameResult | undefined;
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          frameResult = await page.evaluate((frameIdx) => {
            const rec = window.__STAGEFLOW_RECORDER__;
            if (!rec?.stepFrame) {
              throw new Error('__STAGEFLOW_RECORDER__.stepFrame is not ready');
            }
            return rec.stepFrame(frameIdx);
          }, i);
          break;
        } catch (err) {
          if (attempt === 9) throw err;
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      if (!frameResult) {
        throw new Error(`Failed to evaluate frame ${i}`);
      }

      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: captureFormat,
        quality: captureFormat === 'jpeg' ? 96 : undefined,
        fromSurface: true,
      });
      const buffer = Buffer.from(screenshot.data, 'base64');

      await pipeline.writeFrame(buffer);
      onFrameCaptured?.(frameResult);
    }

    await pipeline.close();
  } finally {
    await cdp.detach().catch(() => {});
    await context.close().catch(() => {});
  }
}
