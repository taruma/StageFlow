/**
 * Headless Recorder Viewport Component.
 * Dedicated, chrome-free rendering environment mounted when ?mode=headless-render is present.
 * Exposes window.__STAGEFLOW_RECORDER__ for deterministic, frame-by-frame Playwright stepping.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { SphericalPose, StageFrame, StageScore, Vec3 } from '../core/types';
import { degToRad, sphericalToCartesian } from '../core/sphericalMath';
import { parseStageScore } from '../core/scoreParser';
import { computeStageFrame } from '../core/frameEngine';
import { hasStageFrameBoundaryChanged } from '../core/frameBoundaryDiff';
import { INITIAL_CATALOG_ITEMS } from '../core/scoreCatalog';
import { DioramaCanvas } from '../stage/DioramaCanvas';
import { getDioramaThemeColors } from '../stage/dioramaTheme';
import { preloadStageEnvironmentSkin } from '../stage/StageEnvironmentSkin';
import { StageCamViewfinderOverlay } from '../ui/StageCamViewfinderOverlay';
import { ShotBreakdownHud } from '../ui/ShotBreakdownHud';
import { CameraTelemetryCapsule } from '../ui/CameraTelemetryCapsule';
import type {
  RecorderConfig,
  RecorderFrameResult,
  HeadlessRecorderBridge,
} from './recorderTypes';

const DEFAULT_CONFIG: RecorderConfig = {
  scoreYaml: INITIAL_CATALOG_ITEMS[0].rawYaml,
  cameraMode: 'scripted',
  labelMode: 'all',
  showGuides: false,
  showHud: false,
  dofBlur: undefined,
  theme: 'dark',
  fps: 60,
  width: 1920,
  height: 1080,
  startSec: 0,
  endSec: 0,
};

function applyCustomPoseToFrame(
  frame: StageFrame,
  customPose?: RecorderConfig['customPose']
): StageFrame {
  if (!customPose) return frame;

  const pitchRad = degToRad(customPose.pitchDeg ?? 35.264);
  const yawRad = degToRad(customPose.yawDeg ?? 45);
  const dist = customPose.distanceM ?? 10;
  const targetVec: Vec3 = customPose.target
    ? {
        x: customPose.target[0],
        y: customPose.target[1],
        z: customPose.target[2],
      }
    : { x: 0, y: 1.1, z: 0 };
  const pose: SphericalPose = {
    target: targetVec,
    pitch: pitchRad,
    yaw: yawRad,
    distance: dist,
    roll: 0,
    focalLengthMm: 35,
  };
  const aspect = frame.observerCamera.transform.aspectRatio ?? 16 / 9;
  const transform = sphericalToCartesian(pose, aspect);

  return {
    ...frame,
    observerCamera: {
      ...frame.observerCamera,
      transform,
    },
  };
}

export const HeadlessRecorderView: React.FC = () => {
  const [config, setConfig] = useState<RecorderConfig>(() => {
    if (typeof window !== 'undefined' && window.__STAGEFLOW_RECORDER_CONFIG__) {
      return window.__STAGEFLOW_RECORDER_CONFIG__;
    }
    return DEFAULT_CONFIG;
  });

  const parsedScoreResult = useMemo(() => {
    try {
      const res = parseStageScore(config.scoreYaml);
      return res.score ?? INITIAL_CATALOG_ITEMS[0].score;
    } catch {
      return INITIAL_CATALOG_ITEMS[0].score;
    }
  }, [config.scoreYaml]);

  const score: StageScore = parsedScoreResult;
  const initialFrame = useMemo(
    () =>
      applyCustomPoseToFrame(
        computeStageFrame(config.startSec, score),
        config.customPose
      ),
    [config.startSec, score, config.customPose]
  );

  const [uiFrame, setUiFrame] = useState<StageFrame>(initialFrame);
  const frameRef = useRef<StageFrame>(initialFrame);
  const lastCommittedUiFrameRef = useRef<StageFrame>(initialFrame);
  const lastManualSeekIdRef = useRef<number>(0);
  const r3fTickCountRef = useRef<number>(0);
  const advanceRef = useRef<((timestamp: number) => void) | null>(null);
  const rendererInfoRef = useRef<string | undefined>(undefined);
  const settledSkinUrlsRef = useRef<Set<string>>(new Set());
  const skinErrorRef = useRef<string | null>(null);

  const handleAdvanceReady = useCallback(
    (advance: (timestamp: number) => void, glRenderer?: string) => {
      advanceRef.current = advance;
      if (glRenderer) {
        rendererInfoRef.current = glRenderer;
      }
    },
    []
  );

  const handleSkinLoad = useCallback((url: string) => {
    settledSkinUrlsRef.current.add(url);
  }, []);

  const handleStageSkinError = useCallback(
    (error: Error) => {
      const url = configRef.current.stageSkinUrl;
      if (url) settledSkinUrlsRef.current.add(url);
      skinErrorRef.current = `Stage skin failed to load: ${error.message}`;
    },
    []
  );

  const handleEntitySkinError = useCallback(
    (entityId: string, error: Error) => {
      const url = configRef.current.entitySkinUrls?.[entityId];
      if (url) settledSkinUrlsRef.current.add(url);
      skinErrorRef.current = `Entity skin "${entityId}" failed to load: ${error.message}`;
    },
    []
  );

  const configRef = useRef<RecorderConfig>(config);
  configRef.current = config;

  const scoreRef = useRef<StageScore>(score);
  scoreRef.current = score;

  const effectiveDofBlur =
    config.dofBlur !== undefined
      ? config.dofBlur
      : (score.optics?.dofBlur ?? false);

  const effectiveTheme = config.theme ?? 'dark';
  const themeColors = useMemo(
    () => getDioramaThemeColors(effectiveTheme),
    [effectiveTheme]
  );

  // Synchronize ref on uiFrame change
  useEffect(() => {
    frameRef.current = uiFrame;
  }, [uiFrame]);

  // Frame evaluation tick passed to DioramaCanvas
  const evaluateTick60fps = useCallback(() => {
    r3fTickCountRef.current += 1;
    return frameRef.current;
  }, []);

  // Frame step execution called by Playwright bridge
  const stepFrame = useCallback((frameIndex: number): Promise<RecorderFrameResult> => {
    return new Promise((resolve) => {
      const cfg = configRef.current;
      const currentScore = scoreRef.current;
      const timeOffsetSec = frameIndex / cfg.fps;
      const currentTimestampSec = Math.min(
        cfg.startSec + timeOffsetSec,
        cfg.endSec > cfg.startSec ? cfg.endSec : currentScore.durationSec
      );

      const rawFrame = computeStageFrame(currentTimestampSec, currentScore);
      const nextFrame = applyCustomPoseToFrame(rawFrame, cfg.customPose);
      frameRef.current = nextFrame;
      lastManualSeekIdRef.current += 1;

      const boundaryChanged = hasStageFrameBoundaryChanged(
        lastCommittedUiFrameRef.current,
        nextFrame
      );
      if (boundaryChanged) {
        lastCommittedUiFrameRef.current = nextFrame;
        setUiFrame(nextFrame);
      }

      const finishStep = () => {
        advanceRef.current?.(performance.now());
        const shotId = nextFrame.activeShot?.id ?? null;
        const total = Math.max(
          1,
          Math.ceil(
            ((cfg.endSec > cfg.startSec
              ? cfg.endSec
              : currentScore.durationSec) -
              cfg.startSec) *
              cfg.fps
          )
        );

        // Single rAF ensures WebGL canvas & Drei <Html> transforms flush to compositor
        requestAnimationFrame(() => {
          resolve({
            frameIndex,
            timestampSec: currentTimestampSec,
            shotId,
            totalFrames: total,
          });
        });
      };

      if (boundaryChanged) {
        // Wait 1 rAF so React commits boundary JSX (trails, HUD, labels) before advance()
        requestAnimationFrame(finishStep);
      } else {
        finishStep();
      }
    });
  }, []);

  // Initialize and register bridge on window
  useEffect(() => {
    const bridge: HeadlessRecorderBridge = {
      ready: true,
      init: async (newConfig: RecorderConfig) => {
        configRef.current = newConfig;
        settledSkinUrlsRef.current.clear();
        skinErrorRef.current = null;

        const expectedSkinUrls = [
          newConfig.stageSkinUrl,
          ...Object.values(newConfig.entitySkinUrls ?? {}),
        ].filter((u): u is string => Boolean(u));

        for (const skinUrl of expectedSkinUrls) {
          preloadStageEnvironmentSkin(skinUrl);
        }

        setConfig(newConfig);
        const res = parseStageScore(newConfig.scoreYaml);
        const parsed = res.score ?? INITIAL_CATALOG_ITEMS[0].score;
        scoreRef.current = parsed;
        const effectiveEnd =
          newConfig.endSec > newConfig.startSec
            ? newConfig.endSec
            : parsed.durationSec;
        const total = Math.max(
          1,
          Math.ceil((effectiveEnd - newConfig.startSec) * newConfig.fps)
        );
        const rawFirstFrame = computeStageFrame(newConfig.startSec, parsed);
        const firstFrame = applyCustomPoseToFrame(
          rawFirstFrame,
          newConfig.customPose
        );
        frameRef.current = firstFrame;
        lastCommittedUiFrameRef.current = firstFrame;
        setUiFrame(firstFrame);

        // Wait until R3F advance bridge + all configured .glb/.gltf skins settle,
        // execute post-load synchronous advance() ticks, and flush compositor before Frame 0.
        const initialTickFloor = r3fTickCountRef.current + 4;
        let postSkinTargetTick: number | null =
          expectedSkinUrls.length === 0 ? initialTickFloor : null;
        const deadlineMs =
          performance.now() + (expectedSkinUrls.length > 0 ? 15000 : 5000);

        await new Promise<void>((resolve, reject) => {
          const checkReady = () => {
            if (skinErrorRef.current) {
              reject(new Error(skinErrorRef.current));
              return;
            }

            if (advanceRef.current) {
              advanceRef.current(performance.now());
            }

            const allSkinsSettled = expectedSkinUrls.every((u) =>
              settledSkinUrlsRef.current.has(u)
            );
            if (allSkinsSettled && postSkinTargetTick === null && advanceRef.current) {
              postSkinTargetTick = r3fTickCountRef.current + 2;
            }

            if (
              (allSkinsSettled &&
                advanceRef.current &&
                postSkinTargetTick !== null &&
                r3fTickCountRef.current >= postSkinTargetTick) ||
              performance.now() >= deadlineMs
            ) {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
              });
              return;
            }
            requestAnimationFrame(checkReady);
          };
          requestAnimationFrame(checkReady);
        });

        return {
          totalFrames: total,
          durationSec: effectiveEnd - newConfig.startSec,
          fps: newConfig.fps,
          rendererInfo: rendererInfoRef.current,
        };
      },
      stepFrame,
    };

    window.__STAGEFLOW_RECORDER__ = bridge;

    return () => {
      // Keep bridge defined to prevent transient undefined window.__STAGEFLOW_RECORDER__ during render transitions
    };
  }, [stepFrame]);

  return (
    <div
      id="stageflow-recorder-root"
      className="relative w-screen h-screen overflow-hidden select-none"
      style={{
        width: `${config.width}px`,
        height: `${config.height}px`,
        backgroundColor: themeColors.bg,
      }}
    >
      {/* 3D Blueprint Diorama */}
      <DioramaCanvas
        score={score}
        cameraMode={config.cameraMode}
        isPlaying={false}
        frameloopMode="never"
        preserveDrawingBuffer={true}
        onAdvanceReady={handleAdvanceReady}
        frameRef={frameRef}
        uiFrame={uiFrame}
        lastManualSeekIdRef={lastManualSeekIdRef}
        evaluateTick60fps={evaluateTick60fps}
        onFreeOrbitPoseChange={() => {}}
        labelMode={config.labelMode}
        dofBlurEnabled={effectiveDofBlur}
        themeCategory={effectiveTheme}
        stageSkinUrl={config.stageSkinUrl ?? null}
        stageSkinVisible={true}
        entitySkinUrls={config.entitySkinUrls}
        onSkinLoad={handleSkinLoad}
        onStageSkinError={handleStageSkinError}
        onEntitySkinError={handleEntitySkinError}
      />

      {/* Stage Camera POV Director's Optical Viewfinder Overlay */}
      {config.cameraMode === 'stage-pov' && (
        <StageCamViewfinderOverlay
          score={score}
          frame={uiFrame}
          showGuides={config.showGuides}
        />
      )}

      {/* Optional 2D Viewport HUD Chrome */}
      {config.showHud && (
        <>
          <ShotBreakdownHud
            score={score}
            frame={uiFrame}
            cameraMode={config.cameraMode}
            isPlaying={false}
          />
          <CameraTelemetryCapsule
            observerPose={uiFrame.observerCamera.transform.pose}
            stageCamera={uiFrame.stageCamera}
            observerRig={uiFrame.observerCamera.rig}
            cameraMode={config.cameraMode}
          />
        </>
      )}
    </div>
  );
};
