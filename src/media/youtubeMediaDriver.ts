/**
 * YouTube IFrame Player API implementation of the unified MediaClockDriver.
 * Features high-resolution 60fps drift-corrected time extrapolation so
 * YouTube playback drives the 3D diorama with the exact same silky 60fps
 * precision as a local HTML5 <video> element.
 */

import type {
  MediaClockDriver,
  MediaClockStateCallbacks,
} from './mediaTypes';

interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlaybackRate(): number;
  setPlaybackRate(suggestedRate: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  destroy(): void;
}

interface YTWindow extends Window {
  YT?: {
    Player: new (
      container: HTMLElement,
      options: {
        videoId: string;
        width?: string | number;
        height?: string | number;
        playerVars?: Record<string, string | number>;
        events?: {
          onReady?: () => void;
          onStateChange?: (event: { data: number }) => void;
          onPlaybackRateChange?: (event: { data: number }) => void;
        };
      }
    ) => YTPlayerInstance;
    PlayerState?: {
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };
  };
  onYouTubeIframeAPIReady?: () => void;
}

let ytApiPromise: Promise<void> | null = null;

function ensureYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  const win = window as YTWindow;
  if (win.YT && win.YT.Player) {
    return Promise.resolve();
  }
  if (ytApiPromise) {
    return ytApiPromise;
  }

  ytApiPromise = new Promise<void>((resolve) => {
    const prevCallback = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });

  return ytApiPromise;
}

export const YOUTUBE_DRIFT_DEADBAND_SEC = 0.025;
export const YOUTUBE_DRIFT_SOFT_MAX_SEC = 0.25;
export const YOUTUBE_DRIFT_GAIN = 0.8;
export const YOUTUBE_DRIFT_MIN_SCALE = 0.85;
export const YOUTUBE_DRIFT_MAX_SCALE = 1.15;
export const YOUTUBE_MAX_SILENT_EXTRAPOLATION_SEC = 0.75;

export interface ReconcileYouTubeClockResult {
  anchorVideoTimeSec: number;
  anchorPerfTimeMs: number;
  driftRateScale: number;
  reanchored: boolean;
  snapped: boolean;
}

/**
 * Pure drift reconciliation between YouTube's asynchronous postMessage clock
 * and our 60fps performance.now() extrapolation anchor.
 * - <= 25ms: deadband (keep uninterrupted extrapolation)
 * - 25ms..250ms: re-anchor seamlessly at extrapolated time and trim playback rate
 * - > 250ms: hard snap to YouTube's authoritative timestamp
 */
export function reconcileYouTubeClockSample(params: {
  rawYtTime: number;
  extrapolatedTime: number;
  nowMs: number;
  currentAnchorVideoTimeSec: number;
  currentAnchorPerfTimeMs: number;
  currentDriftRateScale?: number;
}): ReconcileYouTubeClockResult {
  const {
    rawYtTime,
    extrapolatedTime,
    nowMs,
    currentAnchorVideoTimeSec,
    currentAnchorPerfTimeMs,
    currentDriftRateScale = 1.0,
  } = params;
  const drift = rawYtTime - extrapolatedTime;
  const absDrift = Math.abs(drift);

  if (absDrift <= YOUTUBE_DRIFT_DEADBAND_SEC) {
    if (Math.abs(currentDriftRateScale - 1.0) > 1e-6) {
      return {
        anchorVideoTimeSec: extrapolatedTime,
        anchorPerfTimeMs: nowMs,
        driftRateScale: 1.0,
        reanchored: true,
        snapped: false,
      };
    }
    return {
      anchorVideoTimeSec: currentAnchorVideoTimeSec,
      anchorPerfTimeMs: currentAnchorPerfTimeMs,
      driftRateScale: 1.0,
      reanchored: false,
      snapped: false,
    };
  }

  if (absDrift <= YOUTUBE_DRIFT_SOFT_MAX_SEC) {
    const rateScale = Math.max(
      YOUTUBE_DRIFT_MIN_SCALE,
      Math.min(YOUTUBE_DRIFT_MAX_SCALE, 1.0 + drift * YOUTUBE_DRIFT_GAIN)
    );
    return {
      anchorVideoTimeSec: extrapolatedTime,
      anchorPerfTimeMs: nowMs,
      driftRateScale: rateScale,
      reanchored: true,
      snapped: false,
    };
  }

  return {
    anchorVideoTimeSec: rawYtTime,
    anchorPerfTimeMs: nowMs,
    driftRateScale: 1.0,
    reanchored: true,
    snapped: true,
  };
}

export class YouTubeMediaDriver implements MediaClockDriver {
  public readonly kind = 'youtube' as const;
  private player: YTPlayerInstance | null = null;
  private ready = false;
  private playing = false;
  private buffering = false;
  private muted = false;
  private playbackRate = 1.0;
  private driftRateScale = 1.0;
  private fallbackDurationSec: number;
  private callbacks: MediaClockStateCallbacks;
  private destroyed = false;

  // High-resolution extrapolation state for 60fps clock smoothness
  private lastPolledYtTime = 0;
  private anchorVideoTimeSec = 0;
  private anchorPerfTimeMs = 0;
  private pendingSeekTarget: number | null = null;
  private pendingSeekTimestampMs = 0;

  constructor(
    containerElement: HTMLElement,
    videoId: string,
    fallbackDurationSec: number,
    callbacks: MediaClockStateCallbacks = {}
  ) {
    this.fallbackDurationSec = Math.max(0.1, fallbackDurationSec);
    this.callbacks = callbacks;
    this.anchorPerfTimeMs = performance.now();

    ensureYouTubeIframeApi().then(() => {
      if (this.destroyed) return;
      const win = window as YTWindow;
      if (!win.YT || !win.YT.Player) return;

      const mountTarget = document.createElement('div');
      containerElement.innerHTML = '';
      containerElement.appendChild(mountTarget);

      this.player = new win.YT.Player(mountTarget, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            if (this.destroyed || !this.player) return;
            this.ready = true;
            const dur = this.getDuration();
            if (dur > 0) {
              this.callbacks.onDurationChange?.(dur);
            }
          },
          onStateChange: (ev) => {
            if (this.destroyed || !this.player) return;
            const state = ev.data;
            const now = performance.now();
            // 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED, 5 = CUED
            if (state === 1) {
              this.playing = true;
              this.buffering = false;
              this.driftRateScale = 1.0;
              const rawT = this.player.getCurrentTime() || 0;
              const isSeekSettled =
                this.pendingSeekTarget === null ||
                Math.abs(rawT - this.pendingSeekTarget) < 1.5 ||
                now - this.pendingSeekTimestampMs > 600;
              if (isSeekSettled) {
                this.pendingSeekTarget = null;
                this.lastPolledYtTime = rawT;
                this.anchorVideoTimeSec = rawT;
                this.anchorPerfTimeMs = now;
              }
              this.callbacks.onPlayStateChange?.(true);
            } else if (state === 2) {
              this.playing = false;
              this.buffering = false;
              this.driftRateScale = 1.0;
              const polledTime = this.player.getCurrentTime();
              const rawT =
                typeof polledTime === 'number' && Number.isFinite(polledTime)
                  ? polledTime
                  : this.anchorVideoTimeSec;
              const isSeekSettled =
                this.pendingSeekTarget === null ||
                Math.abs(rawT - this.pendingSeekTarget) < 1.5 ||
                now - this.pendingSeekTimestampMs > 600;
              if (isSeekSettled) {
                this.pendingSeekTarget = null;
                this.lastPolledYtTime = rawT;
                this.anchorVideoTimeSec = rawT;
                this.anchorPerfTimeMs = now;
              }
              this.callbacks.onPlayStateChange?.(false);
              if (isSeekSettled) {
                this.callbacks.onSeekSettled?.();
              }
            } else if (state === 3) {
              // BUFFERING: pause extrapolation cleanly in sync without flipping UI play state
              if (this.pendingSeekTarget === null) {
                this.anchorVideoTimeSec = this.computeExtrapolatedTime(now);
                this.anchorPerfTimeMs = now;
              }
              this.buffering = true;
              this.driftRateScale = 1.0;
            } else if (state === 5) {
              this.buffering = false;
              this.driftRateScale = 1.0;
            } else if (state === 0) {
              this.playing = false;
              this.buffering = false;
              this.driftRateScale = 1.0;
              this.pendingSeekTarget = null;
              this.anchorVideoTimeSec = this.getDuration();
              this.callbacks.onPlayStateChange?.(false);
              this.callbacks.onEnded?.();
            }
          },
          onPlaybackRateChange: (ev) => {
            if (this.destroyed) return;
            const newRate = Number(ev.data) || 1.0;
            this.anchorVideoTimeSec = this.getCurrentTime();
            this.anchorPerfTimeMs = performance.now();
            this.playbackRate = newRate;
            this.driftRateScale = 1.0;
            this.callbacks.onRateChange?.(newRate);
          },
        },
      });
    });
  }

  public isReady(): boolean {
    return this.ready;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  private computeExtrapolatedTime(nowMs: number): number {
    if (!this.playing || this.buffering) {
      return this.anchorVideoTimeSec;
    }
    const elapsedSec =
      ((nowMs - this.anchorPerfTimeMs) / 1000) *
      this.playbackRate *
      this.driftRateScale;
    const rawTarget = this.anchorVideoTimeSec + elapsedSec;
    const silentCap = Math.max(
      this.anchorVideoTimeSec,
      this.lastPolledYtTime +
        YOUTUBE_MAX_SILENT_EXTRAPOLATION_SEC * this.playbackRate
    );
    return Math.max(
      0,
      Math.min(this.getDuration(), Math.min(rawTarget, silentCap))
    );
  }

  public getCurrentTime(): number {
    if (!this.ready || !this.player) {
      return this.anchorVideoTimeSec;
    }

    const rawYtTime = this.player.getCurrentTime();
    const now = performance.now();

    // If an asynchronous seek is pending, do not allow stale pre-seek time to revert the anchor
    if (this.pendingSeekTarget !== null) {
      const isClose =
        typeof rawYtTime === 'number' &&
        Number.isFinite(rawYtTime) &&
        Math.abs(rawYtTime - this.pendingSeekTarget) < 1.5;
      const isTimedOut = now - this.pendingSeekTimestampMs > 600;

      if (isClose || isTimedOut) {
        this.pendingSeekTarget = null;
        this.driftRateScale = 1.0;
        if (typeof rawYtTime === 'number' && Number.isFinite(rawYtTime)) {
          this.lastPolledYtTime = rawYtTime;
          this.anchorVideoTimeSec = rawYtTime;
          this.anchorPerfTimeMs = now;
        }
      } else {
        return this.computeExtrapolatedTime(now);
      }
    }

    if (
      typeof rawYtTime === 'number' &&
      Number.isFinite(rawYtTime) &&
      Math.abs(rawYtTime - this.lastPolledYtTime) > 0.001
    ) {
      this.lastPolledYtTime = rawYtTime;
      if (!this.playing || this.buffering) {
        this.anchorVideoTimeSec = rawYtTime;
        this.anchorPerfTimeMs = now;
        this.driftRateScale = 1.0;
      } else {
        const extrapolated = this.computeExtrapolatedTime(now);
        const reconciled = reconcileYouTubeClockSample({
          rawYtTime,
          extrapolatedTime: extrapolated,
          nowMs: now,
          currentAnchorVideoTimeSec: this.anchorVideoTimeSec,
          currentAnchorPerfTimeMs: this.anchorPerfTimeMs,
          currentDriftRateScale: this.driftRateScale,
        });
        this.anchorVideoTimeSec = reconciled.anchorVideoTimeSec;
        this.anchorPerfTimeMs = reconciled.anchorPerfTimeMs;
        this.driftRateScale = reconciled.driftRateScale;
      }
    }

    return this.computeExtrapolatedTime(now);
  }

  public getDuration(): number {
    if (this.ready && this.player) {
      const d = this.player.getDuration();
      if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
        return d;
      }
    }
    return this.fallbackDurationSec;
  }

  public setDuration(durationSec: number): void {
    this.fallbackDurationSec = Math.max(0.1, durationSec);
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public isMuted(): boolean {
    if (this.ready && this.player) {
      return this.player.isMuted();
    }
    return this.muted;
  }

  public async play(): Promise<void> {
    if (this.ready && this.player) {
      this.buffering = false;
      this.driftRateScale = 1.0;
      this.anchorPerfTimeMs = performance.now();
      this.player.playVideo();
    }
  }

  public pause(): void {
    if (this.ready && this.player) {
      this.anchorVideoTimeSec = this.getCurrentTime();
      this.playing = false;
      this.buffering = false;
      this.driftRateScale = 1.0;
      this.player.pauseVideo();
      this.callbacks.onPlayStateChange?.(false);
    }
  }

  public seek(timeSec: number): void {
    const clamped = Math.max(0, Math.min(this.getDuration(), timeSec));
    const now = performance.now();
    this.anchorVideoTimeSec = clamped;
    this.lastPolledYtTime = clamped;
    this.anchorPerfTimeMs = now;
    this.driftRateScale = 1.0;
    this.pendingSeekTarget = clamped;
    this.pendingSeekTimestampMs = now;
    if (this.ready && this.player) {
      this.player.seekTo(clamped, true);
    }
  }

  public setPlaybackRate(rate: number): void {
    const safeRate = Math.max(0.25, Math.min(2.0, rate));
    this.anchorVideoTimeSec = this.getCurrentTime();
    this.anchorPerfTimeMs = performance.now();
    this.playbackRate = safeRate;
    this.driftRateScale = 1.0;
    if (this.ready && this.player) {
      this.player.setPlaybackRate(safeRate);
    }
    this.callbacks.onRateChange?.(safeRate);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ready && this.player) {
      if (muted) {
        this.player.mute();
      } else {
        this.player.unMute();
      }
    }
  }

  public destroy(): void {
    this.destroyed = true;
    this.playing = false;
    this.pendingSeekTarget = null;
    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        // Ignore iframe teardown errors
      }
      this.player = null;
    }
  }
}
