import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Html5MediaDriver } from '../../src/media/html5MediaDriver';
import {
  YouTubeMediaDriver,
  reconcileYouTubeClockSample,
  YOUTUBE_MAX_SILENT_EXTRAPOLATION_SEC,
} from '../../src/media/youtubeMediaDriver';
import { ProceduralMediaDriver } from '../../src/media/proceduralMediaDriver';
import { classifyMediaSource, extractYouTubeId } from '../../src/media/mediaTypes';

describe('mediaTypes — Video Source Classification', () => {
  it('classifies YouTube URLs, Local MP4 paths, and Procedural slates identically', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');

    const ytSource = classifyMediaSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(ytSource.kind).toBe('youtube');
    expect(ytSource.youtubeId).toBe('dQw4w9WgXcQ');

    const localSource = classifyMediaSource('/media/demo_scene.mp4');
    expect(localSource.kind).toBe('html5');

    const procSource = classifyMediaSource('procedural://demo-blueprint');
    expect(procSource.kind).toBe('procedural');
  });
});

describe('MediaClockDrivers - Optimistic In-Flight Seek Synchronization', () => {
  describe('Html5MediaDriver', () => {
    let mockVideo: HTMLVideoElement & { seeking: boolean };
    let eventListeners: Record<string, ((ev?: Event) => void)[]> = {};

    beforeEach(() => {
      eventListeners = {};
      mockVideo = {
        readyState: 4,
        currentTime: 5.0,
        duration: 60.0,
        playbackRate: 1.0,
        paused: true,
        ended: false,
        muted: false,
        seeking: false,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn((event: string, cb: (ev?: Event) => void) => {
          if (!eventListeners[event]) eventListeners[event] = [];
          eventListeners[event].push(cb);
        }),
        removeEventListener: vi.fn((event: string, cb: (ev?: Event) => void) => {
          if (eventListeners[event]) {
            eventListeners[event] = eventListeners[event].filter((fn) => fn !== cb);
          }
        }),
      } as unknown as HTMLVideoElement & { seeking: boolean };
    });

    it('returns optimistic seek target immediately before native video element finishes seeking', () => {
      const driver = new Html5MediaDriver(mockVideo, 60.0);
      expect(driver.getCurrentTime()).toBe(5.0);

      // User seeks to 24.5s
      // Simulate that the browser video element is now seeking and currentTime has not updated yet
      mockVideo.seeking = true;
      driver.seek(24.5);

      // Setting currentTime on video was dispatched
      expect(mockVideo.currentTime).toBe(24.5);

      // Temporarily revert mockVideo.currentTime to simulate async decoder delay
      mockVideo.currentTime = 5.0;

      // getCurrentTime() must optimistically return 24.5 rather than reverting to 5.0
      expect(driver.getCurrentTime()).toBe(24.5);

      // When the native 'seeked' event fires and seeking completes
      mockVideo.seeking = false;
      mockVideo.currentTime = 24.5;
      eventListeners['seeked']?.forEach((cb) => cb());

      expect(driver.getCurrentTime()).toBe(24.5);
      driver.destroy();
    });

    it('releases lock if safety timeout of 500ms elapses without seeked event', () => {
      const driver = new Html5MediaDriver(mockVideo, 60.0);
      mockVideo.seeking = true;
      driver.seek(30.0);
      mockVideo.currentTime = 5.0; // Decoder stalled

      expect(driver.getCurrentTime()).toBe(30.0);

      // Advance performance.now by 501ms
      const nowSpy = vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 501);
      expect(driver.getCurrentTime()).toBe(5.0); // Safely timed out and returned video element time

      nowSpy.mockRestore();
      // When metadata duration is unavailable (NaN), fallback duration updates in-place without changing time
      (mockVideo as { duration: number }).duration = Number.NaN;
      driver.seek(12.5);
      driver.setDuration(25.0);
      expect(driver.getDuration()).toBe(25.0);
      expect(driver.getCurrentTime()).toBe(12.5);
      driver.destroy();
    });
  });

  describe('YouTubeMediaDriver', () => {
    it('anchors to seek target and prevents stale pre-seek polling from reverting anchor', () => {
      const container = {
        innerHTML: '',
        appendChild: vi.fn(),
      } as unknown as HTMLElement;
      const driver = new YouTubeMediaDriver(container, 'dQw4w9WgXcQ', 60.0);

      // Mock internal player ready state
      let mockYtCurrentTime = 3.5;
      (driver as unknown as { player: unknown; ready: boolean }).player = {
        getCurrentTime: () => mockYtCurrentTime,
        getDuration: () => 60.0,
        seekTo: vi.fn(),
        playVideo: vi.fn(),
        pauseVideo: vi.fn(),
        destroy: vi.fn(),
      };
      (driver as unknown as { ready: boolean }).ready = true;

      // Initially at 3.5s
      expect(driver.getCurrentTime()).toBe(3.5);

      // User seeks to 45.0s
      driver.seek(45.0);

      // YouTube iframe still returns 3.5s for the next few frames because postMessage is in flight
      mockYtCurrentTime = 3.5;

      // getCurrentTime() must NOT revert back to 3.5s
      expect(driver.getCurrentTime()).toBe(45.0);

      // When YouTube arrives within 0.35s of the target (e.g. 45.1s)
      mockYtCurrentTime = 45.1;
      expect(driver.getCurrentTime()).toBe(45.1);

      // Updating fallback duration in-place does not alter playhead anchor
      (driver as unknown as { player: { getDuration: () => number } }).player.getDuration =
        () => 0;
      driver.setDuration(90.0);
      expect(driver.getDuration()).toBe(90.0);
      expect(driver.getCurrentTime()).toBe(45.1);

      driver.destroy();
    });

    it('reconciles YouTube clock samples with deadband, monotonic soft rate-trim, and hard snap', () => {
      // 1. Within <= 25ms deadband (and rate 1.0): keeps existing anchor untouched
      const deadband = reconcileYouTubeClockSample({
        rawYtTime: 10.015,
        extrapolatedTime: 10.0,
        nowMs: 5000,
        currentAnchorVideoTimeSec: 9.8,
        currentAnchorPerfTimeMs: 4800,
        currentDriftRateScale: 1.0,
      });
      expect(deadband.reanchored).toBe(false);
      expect(deadband.driftRateScale).toBe(1.0);
      expect(deadband.anchorVideoTimeSec).toBe(9.8);

      // Returning into deadband from trimmed rate re-anchors at extrapolatedTime to prevent backward jump
      const settled = reconcileYouTubeClockSample({
        rawYtTime: 10.275,
        extrapolatedTime: 10.28,
        nowMs: 5250,
        currentAnchorVideoTimeSec: 10.0,
        currentAnchorPerfTimeMs: 5000,
        currentDriftRateScale: 1.12,
      });
      expect(settled.reanchored).toBe(true);
      expect(settled.snapped).toBe(false);
      expect(settled.driftRateScale).toBe(1.0);
      expect(settled.anchorVideoTimeSec).toBe(10.28);

      // 2. Soft window (25ms..250ms): re-anchors seamlessly at extrapolatedTime and trims rate
      const softAhead = reconcileYouTubeClockSample({
        rawYtTime: 10.12,
        extrapolatedTime: 10.0,
        nowMs: 5000,
        currentAnchorVideoTimeSec: 9.75,
        currentAnchorPerfTimeMs: 4750,
        currentDriftRateScale: 1.0,
      });
      expect(softAhead.reanchored).toBe(true);
      expect(softAhead.snapped).toBe(false);
      expect(softAhead.anchorVideoTimeSec).toBe(10.0);
      expect(softAhead.driftRateScale).toBeGreaterThan(1.0);
      expect(softAhead.driftRateScale).toBeLessThanOrEqual(1.15);

      // 3. Large divergence (> 250ms): hard snaps to authoritative YouTube time
      const hardSnap = reconcileYouTubeClockSample({
        rawYtTime: 12.5,
        extrapolatedTime: 10.0,
        nowMs: 5000,
        currentAnchorVideoTimeSec: 9.75,
        currentAnchorPerfTimeMs: 4750,
        currentDriftRateScale: 1.0,
      });
      expect(hardSnap.snapped).toBe(true);
      expect(hardSnap.anchorVideoTimeSec).toBe(12.5);
      expect(hardSnap.driftRateScale).toBe(1.0);
    });

    it('freezes extrapolation during BUFFERING (state 3) without emitting pause and caps silent stalls', () => {
      let nowMs = 1000;
      const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
      const onPlayStateChange = vi.fn();

      const container = {
        innerHTML: '',
        appendChild: vi.fn(),
      } as unknown as HTMLElement;
      const driver = new YouTubeMediaDriver(container, 'dQw4w9WgXcQ', 60.0, {
        onPlayStateChange,
      });

      let mockYtTime = 10.0;
      (driver as unknown as { player: unknown; ready: boolean }).player = {
        getCurrentTime: () => mockYtTime,
        getDuration: () => 60.0,
        seekTo: vi.fn(),
        playVideo: vi.fn(),
        pauseVideo: vi.fn(),
        destroy: vi.fn(),
      };
      (driver as unknown as { ready: boolean }).ready = true;
      (driver as unknown as { playing: boolean; lastPolledYtTime: number; anchorVideoTimeSec: number; anchorPerfTimeMs: number }).playing = true;
      (driver as unknown as { lastPolledYtTime: number }).lastPolledYtTime = 10.0;
      (driver as unknown as { anchorVideoTimeSec: number }).anchorVideoTimeSec = 10.0;
      (driver as unknown as { anchorPerfTimeMs: number }).anchorPerfTimeMs = 1000;

      // Advance 200ms normally
      nowMs = 1200;
      expect(driver.getCurrentTime()).toBeCloseTo(10.2, 4);

      // Simulate YouTube BUFFERING state (state = 3)
      (driver as unknown as { buffering: boolean; anchorVideoTimeSec: number; anchorPerfTimeMs: number }).anchorVideoTimeSec = 10.2;
      (driver as unknown as { anchorPerfTimeMs: number }).anchorPerfTimeMs = 1200;
      (driver as unknown as { buffering: boolean }).buffering = true;

      // Time advances 2 seconds while buffering -> diorama clock stays frozen at 10.2s without calling onPlayStateChange(false)
      nowMs = 3200;
      expect(driver.getCurrentTime()).toBeCloseTo(10.2, 4);
      expect(onPlayStateChange).not.toHaveBeenCalled();

      // Resume playing -> cap prevents runaway silent stall past 0.75s
      (driver as unknown as { buffering: boolean; anchorPerfTimeMs: number }).buffering = false;
      (driver as unknown as { anchorPerfTimeMs: number }).anchorPerfTimeMs = 3200;
      nowMs = 5200; // +2.0s without rawYtTime advancing
      expect(driver.getCurrentTime()).toBeCloseTo(
        10.0 + YOUTUBE_MAX_SILENT_EXTRAPOLATION_SEC,
        4
      );

      nowSpy.mockRestore();
      driver.destroy();
    });
  });

  describe('ProceduralMediaDriver', () => {
    it('seeks synchronously without delay and updates duration in-place without resetting t', async () => {
      const driver = new ProceduralMediaDriver(60.0);
      expect(driver.getCurrentTime()).toBe(0);

      driver.seek(18.25);
      expect(driver.getCurrentTime()).toBe(18.25);

      await driver.play();
      driver.setDuration(75.0);
      expect(driver.getDuration()).toBe(75.0);
      expect(driver.isPlaying()).toBe(true);
      expect(driver.getCurrentTime()).toBeGreaterThanOrEqual(18.25);

      // Shrinking duration below current position clamps cleanly
      driver.pause();
      driver.setDuration(10.0);
      expect(driver.getDuration()).toBe(10.0);
      expect(driver.getCurrentTime()).toBe(10.0);

      driver.destroy();
    });
  });
});
