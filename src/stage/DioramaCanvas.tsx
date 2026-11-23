/**
 * Root React Three Fiber Canvas orchestrating the 60fps evaluation tick,
 * Blueprint Floor Grid, Observer Camera Rig, Illustrative Stage Camera Rig,
 * and Directional Mannequins.
 * Dynamically reacts to the active theme palette with zero extra draw calls.
 */

import React, { useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type {
  AppThemeCategory,
  CameraViewMode,
  LabelDisplayMode,
  SphericalPose,
  StageFrame,
  StageScore,
} from '../core/types';
import { BlueprintStageScene } from './BlueprintStageScene';
import { ObserverCameraRig } from './ObserverCameraRig';
import { StageCameraRig } from './StageCameraRig';
import { StageCamDofEffect } from './StageCamDofEffect';
import { getDioramaThemeColors } from './dioramaTheme';
import { STAGE_FRAME_PRIORITY } from './stageSyncGate';
import type { CameraPresetType } from './cameraPresets';

export interface DioramaCanvasProps {
  score: StageScore;
  cameraMode: CameraViewMode;
  isPlaying: boolean;
  frameRef: React.RefObject<StageFrame>;
  uiFrame: StageFrame;
  lastManualSeekIdRef: React.RefObject<number>;
  evaluateTick60fps: () => StageFrame;
  onFreeOrbitPoseChange: (pose: SphericalPose, immediate?: boolean) => void;
  labelMode?: LabelDisplayMode;
  dofBlurEnabled?: boolean;
  themeCategory?: AppThemeCategory;
  cameraPresetActionRef?: React.RefObject<{
    type: CameraPresetType;
    id: number;
  } | null>;
  cameraPresetSeq?: number;
  sceneResetSeq?: number;
  stageSkinUrl?: string | null;
  stageSkinVisible?: boolean;
  entitySkinUrls?: Record<string, string>;
  frameloopMode?: 'always' | 'demand' | 'never';
  onAdvanceReady?: (
    advance: (timestamp: number) => void,
    glRenderer?: string
  ) => void;
  onSkinLoad?: (url: string) => void;
  onStageSkinError?: (error: Error) => void;
  onEntitySkinError?: (entityId: string, error: Error) => void;
}

const HeadlessAdvanceBridge: React.FC<{
  onAdvanceReady: (
    advance: (timestamp: number) => void,
    glRenderer?: string
  ) => void;
}> = ({ onAdvanceReady }) => {
  const advance = useThree((state) => state.advance);
  const gl = useThree((state) => state.gl);

  React.useEffect(() => {
    let glRenderer: string | undefined;
    try {
      const ctx = gl.getContext();
      const debugExt = ctx.getExtension('WEBGL_debug_renderer_info');
      glRenderer = debugExt
        ? String(ctx.getParameter(debugExt.UNMASKED_RENDERER_WEBGL))
        : String(ctx.getParameter(ctx.RENDERER));
    } catch {
      glRenderer = undefined;
    }
    onAdvanceReady(advance, glRenderer);
  }, [advance, gl, onAdvanceReady]);

  return null;
};

const FrameLoopTicker: React.FC<{ onTick: () => void }> = ({ onTick }) => {
  // Run before OrbitControls (-1) and rig transforms (-0.5) so `frameRef.current` is freshly computed
  useFrame(() => {
    onTick();
  }, STAGE_FRAME_PRIORITY.EVALUATE_FRAME);
  return null;
};

const CanvasDemandInvalidator: React.FC<{
  score: StageScore;
  cameraMode: CameraViewMode;
  isPlaying: boolean;
  uiFrame: StageFrame;
  labelMode: LabelDisplayMode;
  dofBlurEnabled: boolean;
  themeCategory: AppThemeCategory;
  cameraPresetSeq: number;
  sceneResetSeq: number;
  stageSkinUrl?: string | null;
  stageSkinVisible?: boolean;
  entitySkinUrls?: Record<string, string>;
  evaluateTick60fps: () => void;
}> = ({
  score,
  cameraMode,
  isPlaying,
  uiFrame,
  labelMode,
  dofBlurEnabled,
  themeCategory,
  cameraPresetSeq,
  sceneResetSeq,
  stageSkinUrl,
  stageSkinVisible,
  entitySkinUrls,
  evaluateTick60fps,
}) => {
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);

  React.useLayoutEffect(() => {
    if (isPlaying) return;
    evaluateTick60fps();
    invalidate();
  }, [
    score,
    cameraMode,
    isPlaying,
    uiFrame,
    labelMode,
    dofBlurEnabled,
    themeCategory,
    cameraPresetSeq,
    sceneResetSeq,
    stageSkinUrl,
    stageSkinVisible,
    entitySkinUrls,
    size.width,
    size.height,
    evaluateTick60fps,
    invalidate,
  ]);

  return null;
};

export const DioramaCanvas: React.FC<DioramaCanvasProps> = ({
  score,
  cameraMode,
  isPlaying,
  frameRef,
  uiFrame,
  lastManualSeekIdRef,
  evaluateTick60fps,
  onFreeOrbitPoseChange,
  labelMode = 'all',
  dofBlurEnabled = false,
  themeCategory = 'light',
  cameraPresetActionRef,
  cameraPresetSeq = 0,
  sceneResetSeq = 0,
  stageSkinUrl,
  stageSkinVisible = true,
  entitySkinUrls,
  frameloopMode,
  onAdvanceReady,
  onSkinLoad,
  onStageSkinError,
  onEntitySkinError,
}) => {
  const themeColors = useMemo(
    () => getDioramaThemeColors(themeCategory),
    [themeCategory]
  );
  const resolvedFrameloop = frameloopMode ?? (isPlaying ? 'always' : 'demand');

  return (
    <div className="relative w-full h-full bg-app select-none overflow-hidden">
      <Canvas
        frameloop={resolvedFrameloop}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
        dpr={[1, 2]}
        camera={{
          fov: 40,
          near: 0.1,
          far: 250,
          position: [4.5, 3.5, 6.0],
        }}
      >
        <color attach="background" args={[themeColors.bg]} />
        <fog attach="fog" args={[themeColors.fog, 45, 160]} />

        {/* 60fps Stateless Frame Evaluator Tick */}
        <FrameLoopTicker onTick={evaluateTick60fps} />
        {resolvedFrameloop !== 'never' && (
          <CanvasDemandInvalidator
            score={score}
            cameraMode={cameraMode}
            isPlaying={isPlaying}
            uiFrame={uiFrame}
            labelMode={labelMode}
            dofBlurEnabled={dofBlurEnabled}
            themeCategory={themeCategory}
            cameraPresetSeq={cameraPresetSeq}
            sceneResetSeq={sceneResetSeq}
            stageSkinUrl={stageSkinUrl}
            stageSkinVisible={stageSkinVisible}
            entitySkinUrls={entitySkinUrls}
            evaluateTick60fps={evaluateTick60fps}
          />
        )}
        {onAdvanceReady && (
          <HeadlessAdvanceBridge onAdvanceReady={onAdvanceReady} />
        )}

        {/* 1. Shared Diorama Scene (Lighting, Metric Floor Grid, Directional Mannequins) */}
        <BlueprintStageScene
          score={score}
          frameRef={frameRef}
          uiFrame={uiFrame}
          labelMode={labelMode}
          isPlaying={isPlaying}
          cameraMode={cameraMode}
          themeCategory={themeCategory}
          stageSkinUrl={stageSkinUrl}
          stageSkinVisible={stageSkinVisible}
          entitySkinUrls={entitySkinUrls}
          onSkinLoad={onSkinLoad}
          onStageSkinError={onStageSkinError}
          onEntitySkinError={onEntitySkinError}
        />

        {/* 2. Viewport Observer Camera & Free-Orbit Handover Rig */}
        <ObserverCameraRig
          cameraMode={cameraMode}
          isPlaying={isPlaying}
          frameRef={frameRef}
          uiFrame={uiFrame}
          lastManualSeekIdRef={lastManualSeekIdRef}
          onFreeOrbitPoseChange={onFreeOrbitPoseChange}
          cameraPresetActionRef={cameraPresetActionRef}
          sceneResetSeq={sceneResetSeq}
        />

        {/* 3. Illustrative Stage Camera with Rectangular Film Gate Frustum */}
        <StageCameraRig
          frameRef={frameRef}
          cameraMode={cameraMode}
          uiFrame={uiFrame}
          labelMode={labelMode}
        />

        {/* 4. Opt-In Single-Pass Thin-Lens DoF Blur Effect (Stage Cam POV Only) */}
        {dofBlurEnabled && cameraMode === 'stage-pov' && (
          <StageCamDofEffect frameRef={frameRef} uiFrame={uiFrame} />
        )}
      </Canvas>
    </div>
  );
};
