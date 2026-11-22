/**
 * Center stage diorama HUD overlay container.
 * Manages responsive switching between narrow-viewport compact header (<768px)
 * and the 4-corner directorial workspace dock (Shot HUD, ViewCube presets,
 * camera POV switcher, 3D label toggle, and live telemetry capsule).
 * Layer 5 UI Component.
 */

import React, { useState } from 'react';
import { Box, ChevronDown, Eye, EyeOff, X } from 'lucide-react';
import type {
  CameraViewMode,
  LabelDisplayMode,
  SphericalPose,
  StageFrame,
  StageScore,
} from '../core/types';
import type { ActiveSkinEntry } from '../hooks/useStageSkins';
import type { CameraPresetType } from '../stage/cameraPresets';
import { CompactDioramaHeader } from './CompactDioramaHeader';
import { ShotBreakdownHud } from './ShotBreakdownHud';
import { LabelDisplayModeToggle } from './LabelDisplayModeToggle';
import { CameraPresetControls } from './CameraPresetControls';
import { CameraModeSwitcher } from './CameraModeSwitcher';
import { CameraTelemetryCapsule } from './CameraTelemetryCapsule';
import { StageCamViewfinderOverlay } from './StageCamViewfinderOverlay';
import { DioramaMinimap } from './DioramaMinimap';

export interface DioramaOverlayContainerProps {
  score: StageScore;
  frame: StageFrame;
  frameRef?: React.RefObject<StageFrame>;
  liveViewportPose: SphericalPose;
  liveViewportPoseRef?: React.RefObject<SphericalPose>;
  cameraMode: CameraViewMode;
  isPlaying: boolean;
  labelMode: LabelDisplayMode;
  showGuides: boolean;
  dofBlurEnabled?: boolean;
  showMinimap?: boolean;
  isNarrow: boolean;
  dioramaWidth?: number;
  stageSkin?: ActiveSkinEntry | null;
  entitySkins?: Record<string, ActiveSkinEntry>;
  isSkinsVisible?: boolean;
  onToggleSkinsVisible?: () => void;
  onClearStageSkin?: () => void;
  onClearEntitySkin?: (entityId: string) => void;
  onClearAllSkins?: () => void;
  onSetCameraMode: (mode: CameraViewMode) => void;
  onSelectPreset: (preset: CameraPresetType) => void;
  onSelectLabelMode: (mode: LabelDisplayMode) => void;
  onToggleGuides: () => void;
  onToggleDofBlur?: () => void;
  onToggleMinimap?: () => void;
}

export const DioramaOverlayContainer: React.FC<DioramaOverlayContainerProps> = ({
  score,
  frame,
  frameRef,
  liveViewportPose,
  liveViewportPoseRef,
  cameraMode,
  isPlaying,
  labelMode,
  showGuides,
  dofBlurEnabled = false,
  showMinimap = true,
  isNarrow,
  dioramaWidth,
  stageSkin,
  entitySkins = {},
  isSkinsVisible = true,
  onToggleSkinsVisible,
  onClearStageSkin,
  onClearEntitySkin,
  onClearAllSkins,
  onSetCameraMode,
  onSelectPreset,
  onSelectLabelMode,
  onToggleGuides,
  onToggleDofBlur,
  onToggleMinimap,
}) => {
  const fallbackFrameRef = React.useRef(frame);
  fallbackFrameRef.current = frame;
  const resolvedFrameRef = frameRef ?? fallbackFrameRef;
  const [isSkinListOpen, setIsSkinListOpen] = useState(false);

  const entityEntries = Object.entries(entitySkins);
  const totalSkinCount = (stageSkin ? 1 : 0) + entityEntries.length;
  const singleSkinLabel = stageSkin
    ? `Stage: ${stageSkin.name}`
    : entityEntries[0]
    ? `${entityEntries[0][0]}: ${entityEntries[0][1].name}`
    : '';

  const skinPill = totalSkinCount > 0 ? (
    <div className="relative pointer-events-auto select-none">
      <div className="flex items-center gap-1 p-0.5 pl-2 rounded-xl bg-surface border border-border-main shadow-xs max-w-[230px]">
        <Box className="w-3 h-3 text-emerald-500 shrink-0" />
        {totalSkinCount > 1 ? (
          <button
            type="button"
            onClick={() => setIsSkinListOpen((prev) => !prev)}
            className="flex items-center gap-1 text-[10px] font-mono text-text-body hover:text-text-main truncate cursor-pointer"
            title="Inspect or remove active .GLB skins"
          >
            <span>{totalSkinCount} .GLB Skins</span>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </button>
        ) : (
          <span
            className="text-[10px] font-mono text-text-body truncate"
            title={singleSkinLabel}
          >
            {singleSkinLabel}
          </span>
        )}
        {onToggleSkinsVisible && (
          <button
            type="button"
            onClick={onToggleSkinsVisible}
            title={isSkinsVisible ? 'Hide 3D Skins' : 'Show 3D Skins'}
            className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            {isSkinsVisible ? (
              <Eye className="w-3 h-3" />
            ) : (
              <EyeOff className="w-3 h-3" />
            )}
          </button>
        )}
        {onClearAllSkins && (
          <button
            type="button"
            onClick={() => {
              setIsSkinListOpen(false);
              onClearAllSkins();
            }}
            title={totalSkinCount > 1 ? 'Remove All 3D Skins' : 'Remove 3D Skin'}
            className="p-1 rounded-lg text-text-muted hover:text-rose-500 hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {isSkinListOpen && totalSkinCount > 1 && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-surface border border-border-main shadow-xl p-1.5 space-y-1 z-30">
          {stageSkin && (
            <div className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-surface-subtle text-[10px] font-mono">
              <span className="truncate text-text-body" title={stageSkin.name}>
                stage: {stageSkin.name}
              </span>
              {onClearStageSkin && (
                <button
                  type="button"
                  onClick={onClearStageSkin}
                  className="text-text-muted hover:text-rose-500 cursor-pointer shrink-0"
                  title="Remove stage skin"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          {entityEntries.map(([id, entry]) => (
            <div
              key={id}
              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-surface-subtle text-[10px] font-mono"
            >
              <span className="truncate text-text-body" title={`${id}: ${entry.name}`}>
                #{id}: {entry.name}
              </span>
              {onClearEntitySkin && (
                <button
                  type="button"
                  onClick={() => onClearEntitySkin(id)}
                  className="text-text-muted hover:text-rose-500 cursor-pointer shrink-0"
                  title={`Remove skin from ${id}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {/* Stage Camera POV Director's Optical Viewfinder Overlay */}
      {cameraMode === 'stage-pov' && (
        <StageCamViewfinderOverlay
          score={score}
          frame={frame}
          showGuides={showGuides}
        />
      )}

      {/* Narrow Viewport: Dedicated Unified Compact Header (<768px) */}
      {isNarrow ? (
        <>
          <CompactDioramaHeader
            score={score}
            frame={frame}
            cameraMode={cameraMode}
            onSetCameraMode={onSetCameraMode}
            onSelectPreset={onSelectPreset}
            labelMode={labelMode}
            onSelectLabelMode={onSelectLabelMode}
            showGuides={showGuides}
            onToggleGuides={onToggleGuides}
            dofBlurEnabled={dofBlurEnabled}
            onToggleDofBlur={onToggleDofBlur}
          />
          {skinPill && (
            <div className="absolute bottom-3 right-3 z-20">{skinPill}</div>
          )}
        </>
      ) : (
        <>
          {/* 1. TOP-LEFT: Shot & Lens Breakdown HUD (Defaults to 2-line Collapsed Pill) */}
          <ShotBreakdownHud
            score={score}
            frame={frame}
            cameraMode={cameraMode}
            isPlaying={isPlaying}
          />

          {/* 2. TOP-RIGHT: 3D Stage Labels, Guides, DoF Blur, Map Toggle, Active .GLB Skin & Minimap */}
          <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 pointer-events-none select-none">
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <LabelDisplayModeToggle
                labelMode={labelMode}
                onSelectLabelMode={onSelectLabelMode}
                showGuides={showGuides}
                onToggleGuides={onToggleGuides}
                dofBlurEnabled={dofBlurEnabled}
                onToggleDofBlur={onToggleDofBlur}
                showMinimap={showMinimap}
                onToggleMinimap={onToggleMinimap}
                cameraMode={cameraMode}
              />
            </div>
            {skinPill}
            {showMinimap && (
              <DioramaMinimap
                score={score}
                frameRef={resolvedFrameRef}
                liveViewportPoseRef={liveViewportPoseRef}
                uiFrame={frame}
                liveViewportPose={liveViewportPose}
                cameraMode={cameraMode}
                isPlaying={isPlaying}
                onClose={onToggleMinimap}
              />
            )}
          </div>

          {/* 3. BOTTOM-LEFT: Directorial Camera Workstation Dock (ViewCube Presets + Camera POV Modes) */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none select-none">
            {/* Tier 1: View Angle Presets (3D ViewCube Icons) */}
            <CameraPresetControls onSelectPreset={onSelectPreset} />

            {/* Tier 2: Camera POV Mode Switcher (Scripted, Free Orbit, Stage Cam) */}
            <CameraModeSwitcher
              cameraMode={cameraMode}
              onSetCameraMode={onSetCameraMode}
            />
          </div>
        </>
      )}

      {/* 4. BOTTOM-RIGHT: Authoring Telemetry Capsule + 1-Click YAML Copy (Hidden when narrow) */}
      {!isNarrow && (
        <CameraTelemetryCapsule
          observerPose={liveViewportPose}
          stageCamera={frame.stageCamera}
          observerRig={frame.observerCamera.rig}
          cameraMode={cameraMode}
          dioramaWidth={dioramaWidth}
        />
      )}
    </>
  );
};
