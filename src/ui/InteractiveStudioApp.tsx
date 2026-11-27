/**
 * Interactive 3D Choreography Studio Orchestrator.
 * Connects the Scene Catalog, Universal Media Clock, 60fps Dual-Tier Frame Loop,
 * Resizable Split Workspace, 3D Blueprint Diorama, Live YAML Score Drawer,
 * and Persistent Storage (IndexedDB scores + localStorage UI preferences).
 * Decomposed from App.tsx to enable true bundle code-splitting between
 * 3D Three.js Studio runtime and lightweight Markdown/KaTeX documentation modes.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { CameraPresetType } from '../stage/cameraPresets';
import type { StageScore } from '../core/types';
import {
  INITIAL_CATALOG_ITEMS,
  findCatalogItem,
  generateBlankScoreYaml,
  getCachedBundledScore,
  getDefaultSceneId,
  isBundledSceneId,
  loadBundledScore,
  type LoadedScoreCatalogItem,
  type ScoreCatalogItem,
} from '../core/scoreCatalog';
import { parseStageScore } from '../core/scoreParser';
import {
  loadStoredActiveSceneId,
  saveStoredActiveSceneId,
} from '../core/storage/localStorageUi';
import { saveStoredScore } from '../core/storage/scoreDb';
import {
  computeYamlContentHash,
  downloadYamlBlob,
  findDuplicateOrConflictingCustomScore,
  generateCustomScoreId,
  updateScoreYamlId,
  updateScoreYamlTitle,
} from '../core/scoreYamlUtils';
import {
  fetchRemoteScoreYaml,
  parseInitialUrlQueryParams,
} from '../core/scoreUrlLoader';
import {
  ConfirmRemoteScoreModal,
  type RemoteModalMode,
} from './ConfirmRemoteScoreModal';
import { useMediaClock } from '../hooks/useMediaClock';
import { useStageFrameLoop } from '../hooks/useStageFrameLoop';
import { useFileDropLoader } from '../hooks/useFileDropLoader';
import {
  hasFilesInDataTransfer,
  type DroppedAssetKind,
} from '../core/fileDropClassifier';
import { useScorePersistence } from '../hooks/useScorePersistence';
import { useScoreDocument } from '../hooks/useScoreDocument';
import { useAppShellTheme } from '../hooks/useAppShellTheme';
import { useWorkspaceLayout } from '../hooks/useWorkspaceLayout';
import { useStudioDisplaySettings } from '../hooks/useStudioDisplaySettings';
import { useToastNotifications } from '../hooks/useToastNotifications';
import { useStageCamSnapshot } from '../hooks/useStageCamSnapshot';
import { useStageSkins } from '../hooks/useStageSkins';
import { DioramaCanvas } from '../stage/DioramaCanvas';
import { CleanStageCamExportCanvas } from '../stage/CleanStageCamExportCanvas';
import {
  clearStageEnvironmentSkinCache,
  preloadStageEnvironmentSkin,
} from '../stage/StageEnvironmentSkin';
import { AssignStageSkinModal } from './AssignStageSkinModal';
import { WorkspaceHeader } from './WorkspaceHeader';
import { ResizableSplitWorkspace } from './ResizableSplitWorkspace';
import { UniversalVideoViewport } from './UniversalVideoViewport';
import { StageCamMonitorCanvas } from '../stage/StageCamMonitorCanvas';
import {
  VideoWorkspaceSubpanel,
  type SubpanelViewMode,
} from './left-panel/VideoWorkspaceSubpanel';
import { YamlStudioPanel } from './editor';
import { ConfirmResetModal } from './ConfirmResetModal';
import { ScoreLibraryModal, type FilterTab } from './ScoreLibraryModal';
import { MobileScoreLibraryModal } from './library/MobileScoreLibraryModal';
import { AppInfoModal } from './AppInfoModal';
import { CleanVideoExportModal } from './CleanVideoExportModal';
import { StoryboardModal } from './StoryboardModal';
import { useIsMobile } from '../hooks/useIsMobile';
import { ToastContainer } from './ToastContainer';
import { DirectorialTransportBar } from './DirectorialTransportBar';
import { DioramaOverlayContainer } from './DioramaOverlayContainer';
import { DioramaMinimap } from './DioramaMinimap';

const DIORAMA_ACCEPTED_KINDS: readonly DroppedAssetKind[] = ['yaml', 'skin'];
const VIDEO_ACCEPTED_KINDS: readonly DroppedAssetKind[] = ['video'];

export const InteractiveStudioApp: React.FC = () => {
  const theme = useAppShellTheme();
  const { toasts, showToast, dismissToast } = useToastNotifications();
  const layout = useWorkspaceLayout({ onNotify: showToast });
  const display = useStudioDisplaySettings();
  const isMobile = useIsMobile();
  const stageCamSnapshot = useStageCamSnapshot({ onNotify: showToast });
  const [subpanelViewMode, setSubpanelViewMode] =
    useState<SubpanelViewMode>('brief');

  const [catalog, setCatalog] = useState<ScoreCatalogItem[]>(() =>
    INITIAL_CATALOG_ITEMS.map((item) => getCachedBundledScore(item.id) ?? item)
  );

  // Synchronously hydrate active scene id from localStorage or ?score= / ?scene= query param
  const [activeSceneId, setActiveSceneIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const { scoreId } = parseInitialUrlQueryParams(window.location.search);
      if (scoreId) {
        const matched = findCatalogItem(scoreId, INITIAL_CATALOG_ITEMS);
        if (matched) return matched.id;
        return scoreId; // preserve pointer until storage hydration reconciles
      }
    }
    const stored = loadStoredActiveSceneId();
    return stored || getDefaultSceneId();
  });

  const setActiveSceneId = useCallback((id: string) => {
    setActiveSceneIdState(id);
    saveStoredActiveSceneId(id);
  }, []);

  // Reset per-character visual hides when switching scenes
  useEffect(() => {
    display.handleClearHiddenCharacters();
  }, [activeSceneId, display.handleClearHiddenCharacters]);

  // Score Library Modal state & initial category tab
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryInitialTab, setLibraryInitialTab] = useState<
    FilterTab | undefined
  >(undefined);

  // App Info Modal state
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // In-browser Clean Stage Cam MP4 Export Modal state
  const [isVideoExportOpen, setIsVideoExportOpen] = useState(false);

  // Storyboard Contact Sheet Modal state
  const [isStoryboardOpen, setIsStoryboardOpen] = useState(false);

  // Global '?' shortcut to open Info / Shortcuts Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsInfoOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Measure diorama pane width to toggle between standard and compact header (<768px)
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const [dioramaWidth, setDioramaWidth] = useState<number>(1000);

  useEffect(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setDioramaWidth(rect.width);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isNarrowDiorama = dioramaWidth < 768;

  const cachedInitialItem =
    getCachedBundledScore(activeSceneId) ??
    getCachedBundledScore(getDefaultSceneId());
  const initialBlankYaml = cachedInitialItem
    ? null
    : generateBlankScoreYaml(activeSceneId);
  const initialItem = cachedInitialItem ?? {
    id: activeSceneId,
    rawYaml: initialBlankYaml!,
    score: parseStageScore(initialBlankYaml!, activeSceneId).score!,
  };

  const [sceneResetSeq, setSceneResetSeq] = useState<number>(0);
  const triggerScoreReset = useCallback(() => {
    setSceneResetSeq((seq) => seq + 1);
  }, []);
  const [videoOverrideUrl, setVideoOverrideUrl] = useState<string | null>(null);

  const saveDraftRef = useRef<
    ((nextYaml: string, parsedScore: StageScore) => void) | null
  >(null);
  const handleSaveDraftProxy = useCallback(
    (nextYaml: string, parsedScore: StageScore) => {
      saveDraftRef.current?.(nextYaml, parsedScore);
    },
    []
  );
  const handleClearVideoOverride = useCallback(() => {
    setVideoOverrideUrl(null);
  }, []);

  const doc = useScoreDocument({
    initialYaml: initialItem.rawYaml,
    initialScore: initialItem.score,
    activeSceneId,
    isBundled: isBundledSceneId(activeSceneId),
    onSaveDraftDebounced: handleSaveDraftProxy,
    onVideoUrlActive: handleClearVideoOverride,
  });

  // Sync YAML score `optics.dof_blur` preference when a score explicitly opts in
  useEffect(() => {
    if (doc.activeScore.optics?.dofBlur === true) {
      display.setDofBlurEnabled(true);
    }
  }, [doc.activeScore.optics?.dofBlur, display.setDofBlurEnabled]);

  const handleExportScore = useCallback(
    async (item: ScoreCatalogItem) => {
      let yamlToExport = item.rawYaml;
      if (!yamlToExport && !item.isCustom && isBundledSceneId(item.id)) {
        try {
          const loaded = await loadBundledScore(item.id);
          yamlToExport = loaded.rawYaml;
          setCatalog((prev) =>
            prev.map((c) => (c.id === loaded.id ? loaded : c))
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          showToast(`Failed to export score "${item.title}": ${msg}`, 'error');
          return;
        }
      }
      if (!yamlToExport) {
        showToast(
          `Score "${item.title}" has no YAML content to export`,
          'error'
        );
        return;
      }
      downloadYamlBlob(`${item.id}.yaml`, yamlToExport);
      showToast(`Exported score "${item.id}.yaml"`, 'success');
    },
    [showToast]
  );

  const handleExportActiveScore = useCallback(() => {
    void handleExportScore({
      id: activeSceneId,
      title: doc.activeScore.title,
      category: 'custom',
      durationSec: doc.activeScore.durationSec,
      shotCount: doc.activeScore.shots.length,
      aspectRatio: doc.activeScore.aspectRatio,
      videoUrl: doc.activeScore.videoUrl,
      rawYaml: doc.rawYaml,
      score: doc.activeScore,
      isCustom: false,
    });
  }, [activeSceneId, doc.activeScore, doc.rawYaml, handleExportScore]);

  // IndexedDB Score Persistence Hook (Hydration, Forking, Draft Auto-saving, Project Lifecycle)
  const [remoteModalState, setRemoteModalState] = useState<{
    isOpen: boolean;
    mode: RemoteModalMode;
    targetUrl?: string;
    existingItem?: ScoreCatalogItem;
    sourceFileName?: string;
    pendingYaml?: string;
    pendingScore?: StageScore;
    isLoading?: boolean;
  }>({
    isOpen: false,
    mode: 'url-import',
  });

  const handleScoreNotFound = useCallback(
    (requestedId: string) => {
      showToast(
        `Score "${requestedId}" not found in library; loaded default score`,
        'info'
      );
    },
    [showToast]
  );

  const handleOpenedExistingScore = useCallback(
    (title: string) => {
      showToast(`Opened existing project "${title}" from library`, 'info');
    },
    [showToast]
  );

  const handlePendingRemoteUrl = useCallback(
    (
      url: string,
      status: {
        kind: 'new' | 'identical' | 'conflict';
        existingItem?: ScoreCatalogItem;
      }
    ) => {
      if (status.kind === 'identical') {
        return;
      }
      if (status.kind === 'conflict' && status.existingItem) {
        setRemoteModalState({
          isOpen: true,
          mode: 'url-conflict',
          targetUrl: url,
          existingItem: status.existingItem,
          isLoading: false,
        });
      } else {
        setRemoteModalState({
          isOpen: true,
          mode: 'url-import',
          targetUrl: url,
          isLoading: false,
        });
      }
    },
    []
  );

  const scorePersistence = useScorePersistence({
    catalog,
    activeSceneId,
    rawYaml: doc.rawYaml,
    initialMountedSceneId: initialItem.id,
    setCatalog,
    setActiveSceneId,
    setRawYaml: doc.setRawYamlExternal,
    setActiveScore: doc.setActiveScoreExternal,
    onClearVideoOverride: handleClearVideoOverride,
    onScoreReset: triggerScoreReset,
    onScoreNotFound: handleScoreNotFound,
    onPendingRemoteUrl: handlePendingRemoteUrl,
    onOpenedExistingScore: handleOpenedExistingScore,
  });
  saveDraftRef.current = scorePersistence.saveYamlDraftDebounced;

  const stageSyncCallbackRef = useRef<(() => void) | null>(null);
  const handleStageTimeJump = useCallback(() => {
    stageSyncCallbackRef.current?.();
  }, []);

  // 1. Universal Media Clock (Local HTML5 Video, YouTube IFrame, or Procedural Slate)
  const mediaClock = useMediaClock(
    doc.effectiveScore,
    videoOverrideUrl,
    handleStageTimeJump,
    sceneResetSeq
  );

  // 2. Dual-Tier 60fps Frame Evaluation Loop
  const stageLoop = useStageFrameLoop(
    doc.effectiveScore,
    mediaClock.driverRef,
    mediaClock.loopActiveShot,
    mediaClock.isPlaying,
    mediaClock.lastManualSeekIdRef,
    sceneResetSeq
  );

  const { evaluateTick60fps, forceSyncUi } = stageLoop;
  useEffect(() => {
    stageSyncCallbackRef.current = () => {
      evaluateTick60fps();
      forceSyncUi();
    };
  }, [evaluateTick60fps, forceSyncUi]);

  const cameraPresetIdRef = useRef(0);
  const [cameraPresetSeq, setCameraPresetSeq] = useState(0);
  const cameraPresetActionRef = useRef<{
    type: CameraPresetType;
    id: number;
  } | null>(null);

  const handleSelectCameraPreset = useCallback(
    (preset: CameraPresetType) => {
      if (preset === 'reset') {
        stageLoop.setCameraMode('scripted');
      } else {
        stageLoop.setCameraMode('free');
      }
      cameraPresetIdRef.current += 1;
      cameraPresetActionRef.current = {
        type: preset,
        id: cameraPresetIdRef.current,
      };
      setCameraPresetSeq(cameraPresetIdRef.current);
    },
    [stageLoop]
  );

  const selectSceneSeqRef = useRef(0);

  // Switch between catalog scenes (lazy-loading bundled YAML payloads on demand)
  const handleSelectScene = useCallback(
    async (sceneId: string) => {
      const found = catalog.find((item) => item.id === sceneId);
      if (!found) return;

      const seq = ++selectSceneSeqRef.current;
      let resolvedYaml = found.rawYaml;
      let resolvedScore = found.score;

      if (
        (!resolvedYaml || !resolvedScore) &&
        !found.isCustom &&
        isBundledSceneId(found.id)
      ) {
        try {
          const loaded = await loadBundledScore(found.id);
          if (seq !== selectSceneSeqRef.current) return;
          resolvedYaml = loaded.rawYaml;
          resolvedScore = loaded.score;
          setCatalog((prev) =>
            prev.map((c) => (c.id === loaded.id ? loaded : c))
          );
        } catch (err: unknown) {
          if (seq !== selectSceneSeqRef.current) return;
          const msg = err instanceof Error ? err.message : String(err);
          showToast(`Failed to load score "${found.title}": ${msg}`, 'error');
          return;
        }
      }

      if (seq !== selectSceneSeqRef.current) return;
      if (!resolvedYaml || !resolvedScore) return;

      mediaClock.pause();
      setActiveSceneId(found.id);
      doc.resetDocument(resolvedYaml, resolvedScore);
      setVideoOverrideUrl(null);
      triggerScoreReset();
    },
    [catalog, doc.resetDocument, mediaClock, setActiveSceneId, showToast, triggerScoreReset]
  );

  const handleEnsureScoreLoaded = useCallback(
    async (sceneId: string) => {
      const existing = catalog.find((c) => c.id === sceneId);
      if (existing?.score && existing?.rawYaml) return;
      if (!isBundledSceneId(sceneId)) return;

      try {
        const loaded = await loadBundledScore(sceneId);
        setCatalog((prev) =>
          prev.map((c) =>
            c.id === loaded.id && (!c.score || !c.rawYaml) ? loaded : c
          )
        );
      } catch {
        // Inspector remains responsive with lightweight metadata if load fails
      }
    },
    [catalog]
  );

  const handleForkScore = useCallback(async () => {
    const forked = await scorePersistence.forkScoreAsCustom(activeSceneId);
    if (forked) {
      showToast(`Forked "${forked.title}" as Custom Project`, 'success');
    }
  }, [activeSceneId, scorePersistence.forkScoreAsCustom, showToast]);

  const handleCloseRemoteModal = useCallback(() => {
    setRemoteModalState((prev) => ({
      ...prev,
      isOpen: false,
      isLoading: false,
      pendingYaml: undefined,
      pendingScore: undefined,
    }));
  }, []);

  const handleExecuteRemoteImport = useCallback(
    async (
      targetUrl: string,
      asNewCopy = false,
      overwriteItem?: ScoreCatalogItem
    ) => {
      setRemoteModalState((prev) => ({ ...prev, isLoading: true }));
      try {
        showToast('Fetching remote score...', 'info');
        const result = await fetchRemoteScoreYaml(targetUrl);
        const hash = computeYamlContentHash(result.rawYaml);

        let finalId = overwriteItem
          ? overwriteItem.id
          : generateCustomScoreId(result.fallbackId);
        let finalTitle = result.score.title;

        if (asNewCopy && overwriteItem) {
          finalTitle = `${overwriteItem.title} (Remote)`;
          finalId = generateCustomScoreId(result.fallbackId);
        }

        let finalYaml = result.rawYaml;
        if (isBundledSceneId(finalId) || asNewCopy || !overwriteItem) {
          finalYaml = updateScoreYamlId(finalYaml, finalId);
          if (asNewCopy) {
            finalYaml = updateScoreYamlTitle(finalYaml, finalTitle);
          }
        }

        const finalParsed = parseStageScore(finalYaml, finalId);
        const resolvedScore = finalParsed.score ?? result.score;

        const now = Date.now();
        const newItem: LoadedScoreCatalogItem = {
          id: finalId,
          title: finalTitle,
          subtitle: resolvedScore.subtitle,
          category: 'custom',
          updatedAt: now,
          durationSec: resolvedScore.durationSec,
          shotCount: resolvedScore.shots.length,
          aspectRatio: resolvedScore.aspectRatio,
          videoUrl: resolvedScore.videoUrl,
          rawYaml: finalYaml,
          score: resolvedScore,
          isCustom: true,
          contentHash: hash,
          originalContentHash: hash,
          sourceUrl: targetUrl,
          sourceFileName: result.fileName,
        };

        await saveStoredScore({
          id: newItem.id,
          title: newItem.title,
          subtitle: newItem.subtitle,
          rawYaml: finalYaml,
          isCustom: true,
          updatedAt: now,
          contentHash: hash,
          originalContentHash: hash,
          sourceUrl: targetUrl,
          sourceFileName: result.fileName,
        });

        setCatalog((prev) => {
          const filtered = prev.filter((item) => item.id !== newItem.id);
          return [...filtered, newItem];
        });

        setActiveSceneId(newItem.id);
        doc.resetDocument(finalYaml, resolvedScore);
        doc.setParseWarning(finalParsed.warning ?? result.warning ?? null);
        setVideoOverrideUrl(null);
        triggerScoreReset();

        handleCloseRemoteModal();
        showToast(
          overwriteItem && !asNewCopy
            ? `Updated "${newItem.title}" from remote score`
            : `Imported "${newItem.title}" into Custom Projects`,
          'success'
        );
      } catch (err: unknown) {
        setRemoteModalState((prev) => ({ ...prev, isLoading: false }));
        const msg = err instanceof Error ? err.message : String(err);
        showToast(`Failed to load remote score: ${msg}`, 'error');
      }
    },
    [handleCloseRemoteModal, setActiveSceneId, showToast, triggerScoreReset]
  );

  const handleResolveFileConflict = useCallback(
    async (action: 'overwrite' | 'copy' | 'keep') => {
      if (
        action === 'keep' ||
        !remoteModalState.existingItem ||
        !remoteModalState.pendingYaml
      ) {
        handleCloseRemoteModal();
        return;
      }

      const existing = remoteModalState.existingItem;
      const yaml = remoteModalState.pendingYaml;
      const parsed =
        remoteModalState.pendingScore ??
        parseStageScore(yaml, existing.id).score;
      if (!parsed) {
        handleCloseRemoteModal();
        return;
      }

      const hash = computeYamlContentHash(yaml);

      if (action === 'overwrite') {
        const finalYaml = updateScoreYamlId(yaml, existing.id);
        const finalParsed = parseStageScore(finalYaml, existing.id);
        const resolvedScore = finalParsed.score ?? parsed;

        const now = Date.now();
        const updatedItem: LoadedScoreCatalogItem = {
          ...existing,
          title: resolvedScore.title,
          subtitle: resolvedScore.subtitle,
          updatedAt: now,
          durationSec: resolvedScore.durationSec,
          shotCount: resolvedScore.shots.length,
          aspectRatio: resolvedScore.aspectRatio,
          videoUrl: resolvedScore.videoUrl,
          rawYaml: finalYaml,
          score: resolvedScore,
          contentHash: hash,
          originalContentHash: hash,
          sourceFileName:
            remoteModalState.sourceFileName ?? existing.sourceFileName,
        };

        await saveStoredScore({
          id: existing.id,
          title: updatedItem.title,
          subtitle: updatedItem.subtitle,
          rawYaml: finalYaml,
          isCustom: true,
          updatedAt: now,
          contentHash: hash,
          originalContentHash: hash,
          sourceFileName: updatedItem.sourceFileName,
          sourceUrl: existing.sourceUrl,
        });

        setCatalog((prev) =>
          prev.map((item) => (item.id === existing.id ? updatedItem : item))
        );
        setActiveSceneId(existing.id);
        doc.resetDocument(finalYaml, resolvedScore);
        triggerScoreReset();
        handleCloseRemoteModal();
        showToast(
          `Updated project "${updatedItem.title}" with dropped file`,
          'success'
        );
      } else if (action === 'copy') {
        const fallbackId =
          remoteModalState.sourceFileName?.replace(/\.(yaml|yml|json)$/i, '') ||
          existing.id;
        const newId = generateCustomScoreId(fallbackId);
        const newTitle = `${parsed.title || existing.title} (Copy)`;
        let finalYaml = updateScoreYamlId(yaml, newId);
        finalYaml = updateScoreYamlTitle(finalYaml, newTitle);

        const finalParsed = parseStageScore(finalYaml, newId);
        const resolvedScore = finalParsed.score ?? parsed;

        const now = Date.now();
        const newItem: LoadedScoreCatalogItem = {
          id: newId,
          title: newTitle,
          subtitle: resolvedScore.subtitle,
          category: 'custom',
          updatedAt: now,
          durationSec: resolvedScore.durationSec,
          shotCount: resolvedScore.shots.length,
          aspectRatio: resolvedScore.aspectRatio,
          videoUrl: resolvedScore.videoUrl,
          rawYaml: finalYaml,
          score: resolvedScore,
          isCustom: true,
          contentHash: hash,
          originalContentHash: hash,
          sourceFileName: remoteModalState.sourceFileName,
        };

        await saveStoredScore({
          id: newItem.id,
          title: newItem.title,
          subtitle: newItem.subtitle,
          rawYaml: finalYaml,
          isCustom: true,
          updatedAt: now,
          contentHash: hash,
          originalContentHash: hash,
          sourceFileName: newItem.sourceFileName,
        });

        setCatalog((prev) => [...prev, newItem]);
        setActiveSceneId(newItem.id);
        doc.resetDocument(finalYaml, resolvedScore);
        triggerScoreReset();
        handleCloseRemoteModal();
        showToast(
          `Imported "${newItem.title}" as new Custom Project`,
          'success'
        );
      }
    },
    [
      handleCloseRemoteModal,
      remoteModalState,
      setActiveSceneId,
      showToast,
      triggerScoreReset,
    ]
  );

  // Drag-and-drop / File picker handlers for custom .yaml and .mp4 files
  const handleLoadYamlFile = useCallback(
    (yamlText: string, fileName: string) => {
      const fallbackId = fileName.replace(/\.(yaml|yml|json)$/i, '');
      const parsed = parseStageScore(yamlText, fallbackId);
      if (!parsed.score) {
        doc.resetDocument(yamlText);
        layout.openEditMode('yaml');
        showToast(
          `Failed to parse YAML: ${parsed.error ?? 'Syntax error'}`,
          'error'
        );
        return;
      }

      // Check against existing Custom Projects using Unified Content-Hash Matcher
      const customItems = catalog.filter(
        (c): c is LoadedScoreCatalogItem =>
          Boolean(c.isCustom && c.rawYaml && c.score)
      );
      const match = findDuplicateOrConflictingCustomScore(
        {
          rawYaml: yamlText,
          id: parsed.score.id,
          sourceFileName: fileName,
        },
        customItems
      );

      // Case 1: Identical content hash match -> Open existing instantly with zero duplicate!
      if (match.kind === 'identical') {
        const existing = match.existingItem;
        setActiveSceneId(existing.id);
        doc.resetDocument(existing.rawYaml, existing.score);
        setVideoOverrideUrl(null);
        triggerScoreReset();
        showToast(
          `Opened existing project "${existing.title}" (identical score already in library)`,
          'info'
        );
        return;
      }

      // Case 2: Identity match with differing content -> Open conflict modal
      if (match.kind === 'conflict') {
        setRemoteModalState({
          isOpen: true,
          mode: 'file-conflict',
          existingItem: match.existingItem,
          sourceFileName: fileName,
          pendingYaml: yamlText,
          pendingScore: parsed.score,
          isLoading: false,
        });
        return;
      }

      // Case 3: Brand new score -> Save as new Custom Project
      let finalId = parsed.score.id;
      let finalYaml = yamlText;
      let wasBundledConflict = false;

      // Auto-fork collision protection: never overwrite bundled presets or duplicate IDs
      if (isBundledSceneId(finalId) || catalog.some((c) => c.id === finalId)) {
        wasBundledConflict = true;
        finalId = generateCustomScoreId(fallbackId || finalId);
        finalYaml = updateScoreYamlId(finalYaml, finalId);
      }

      const finalParsed = parseStageScore(finalYaml, finalId);
      const resolvedScore = finalParsed.score ?? parsed.score;
      const hash = computeYamlContentHash(finalYaml);

      const now = Date.now();
      const newItem: LoadedScoreCatalogItem = {
        id: finalId,
        title: resolvedScore.title,
        subtitle: resolvedScore.subtitle,
        category: 'custom',
        updatedAt: now,
        durationSec: resolvedScore.durationSec,
        shotCount: resolvedScore.shots.length,
        aspectRatio: resolvedScore.aspectRatio,
        videoUrl: resolvedScore.videoUrl,
        rawYaml: finalYaml,
        score: resolvedScore,
        isCustom: true,
        contentHash: hash,
        originalContentHash: hash,
        sourceFileName: fileName,
      };

      setCatalog((prev) => {
        const filtered = prev.filter((item) => item.id !== newItem.id);
        return [...filtered, newItem];
      });
      setActiveSceneId(newItem.id);
      doc.resetDocument(finalYaml, resolvedScore);
      doc.setParseWarning(finalParsed.warning ?? parsed.warning ?? null);
      setVideoOverrideUrl(null);
      triggerScoreReset();

      // Persist custom imported score to IndexedDB
      saveStoredScore({
        id: newItem.id,
        title: newItem.title,
        subtitle: newItem.subtitle,
        rawYaml: finalYaml,
        isCustom: true,
        updatedAt: now,
        contentHash: hash,
        originalContentHash: hash,
        sourceFileName: fileName,
      });

      if (wasBundledConflict) {
        showToast(
          `Bundled ID detected: imported "${resolvedScore.title}" as new Custom Project`,
          'info'
        );
      } else {
        showToast(
          `Imported "${resolvedScore.title}" into Custom Projects`,
          'success'
        );
      }
    },
    [catalog, layout, setActiveSceneId, showToast, triggerScoreReset]
  );

  const handleLoadVideoBlobUrl = useCallback(
    (blobUrl: string) => {
      setVideoOverrideUrl(blobUrl);
      mediaClock.seek(0);
      showToast('Loaded local video override', 'info');
    },
    [mediaClock, showToast]
  );

  const stageSkins = useStageSkins({
    entities: doc.activeScore.entities,
    onPreloadSkin: preloadStageEnvironmentSkin,
    onReleaseSkinCache: clearStageEnvironmentSkinCache,
    onNotify: showToast,
  });

  const handleDioramaRejectedFiles = useCallback(
    (rejectedKinds: DroppedAssetKind[]) => {
      if (rejectedKinds.includes('video')) {
        showToast(
          'Drop reference videos onto the Video panel on the left (or use File ▾)',
          'info'
        );
      } else {
        showToast(
          'Unsupported file for 3D Diorama. Drop .YAML scores or .GLB/.GLTF skins',
          'error'
        );
      }
    },
    [showToast]
  );

  const handleVideoRejectedFiles = useCallback(
    (rejectedKinds: DroppedAssetKind[]) => {
      if (rejectedKinds.includes('yaml') || rejectedKinds.includes('skin')) {
        showToast(
          'Drop .YAML scores and .GLB/.GLTF skins onto the 3D Diorama window',
          'info'
        );
      } else {
        showToast(
          'Unsupported file for Video panel. Drop .MP4, .WEBM, or .MOV videos',
          'error'
        );
      }
    },
    [showToast]
  );

  const dioramaDrop = useFileDropLoader({
    acceptedKinds: DIORAMA_ACCEPTED_KINDS,
    onLoadYamlText: handleLoadYamlFile,
    onLoadStageSkinBlobUrl: stageSkins.enqueueSkinDrop,
    onRejectedFiles: handleDioramaRejectedFiles,
  });

  const videoDrop = useFileDropLoader({
    acceptedKinds: VIDEO_ACCEPTED_KINDS,
    onLoadVideoBlobUrl: handleLoadVideoBlobUrl,
    onRejectedFiles: handleVideoRejectedFiles,
  });

  const menuFileDrop = useFileDropLoader({
    onLoadYamlText: handleLoadYamlFile,
    onLoadVideoBlobUrl: handleLoadVideoBlobUrl,
    onLoadStageSkinBlobUrl: stageSkins.enqueueSkinDrop,
  });

  const [isFileDragActive, setIsFileDragActive] = useState(false);
  const windowDragDepthRef = useRef(0);

  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      if (!hasFilesInDataTransfer(e.dataTransfer)) return;
      windowDragDepthRef.current += 1;
      setIsFileDragActive(true);
    };
    const handleWindowDragLeave = (e: DragEvent) => {
      if (!hasFilesInDataTransfer(e.dataTransfer)) return;
      windowDragDepthRef.current = Math.max(0, windowDragDepthRef.current - 1);
      if (windowDragDepthRef.current === 0) {
        setIsFileDragActive(false);
      }
    };
    const resetWindowDrag = () => {
      windowDragDepthRef.current = 0;
      setIsFileDragActive(false);
    };

    window.addEventListener('dragenter', handleWindowDragEnter, true);
    window.addEventListener('dragleave', handleWindowDragLeave, true);
    window.addEventListener('drop', resetWindowDrag, true);
    window.addEventListener('dragend', resetWindowDrag, true);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter, true);
      window.removeEventListener('dragleave', handleWindowDragLeave, true);
      window.removeEventListener('drop', resetWindowDrag, true);
      window.removeEventListener('dragend', resetWindowDrag, true);
    };
  }, []);

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFilesInDataTransfer(e.dataTransfer)) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'none';
    }
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    if (!hasFilesInDataTransfer(e.dataTransfer)) return;
    e.preventDefault();
  }, []);

  const handleSeekAndSync = useCallback(
    (targetSec: number) => {
      mediaClock.seek(targetSec);
    },
    [mediaClock]
  );

  const handleVisualSeekToTime = useCallback(
    (targetSec: number) => {
      mediaClock.pause();
      mediaClock.seek(targetSec);
    },
    [mediaClock]
  );

  const getCurrentTimeSec = useCallback(() => {
    return mediaClock.driverRef.current?.getCurrentTime() ?? 0;
  }, [mediaClock.driverRef]);

  const handleStepFramesAndSync = useCallback(
    (frames: number) => {
      mediaClock.stepFrames(frames);
    },
    [mediaClock]
  );

  const { captureSnapshot } = stageCamSnapshot;
  const handleCaptureStageCamSnapshot = useCallback(() => {
    captureSnapshot({
      score: doc.activeScore,
      timestampSec: stageLoop.frameRef.current.timestampSec,
      dofBlurEnabled: display.dofBlurEnabled,
      themeCategory: theme.effectiveDioramaCategory,
      stageSkinUrl: stageSkins.effectiveStageSkinUrl,
      entitySkinUrls: stageSkins.effectiveEntitySkinUrls,
    });
  }, [
    captureSnapshot,
    doc.activeScore,
    stageLoop.frameRef,
    display.dofBlurEnabled,
    theme.effectiveDioramaCategory,
    stageSkins.effectiveStageSkinUrl,
    stageSkins.effectiveEntitySkinUrls,
  ]);

  return (
    <div
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
      className="relative w-full h-dvh flex flex-col bg-app text-text-main overflow-hidden"
    >
      {/* Top Studio Header */}
      <WorkspaceHeader
        catalog={catalog}
        activeSceneId={activeSceneId}
        splitPreset={layout.splitPreset}
        isEditMode={layout.isEditMode}
        editorMode={layout.editorMode}
        storageStatus={scorePersistence.storageStatus}
        isLibraryOpen={isLibraryOpen}
        isInfoOpen={isInfoOpen}
        themeMode={theme.themeMode}
        effectiveThemeCategory={theme.effectiveCategory}
        dioramaThemeMode={theme.dioramaThemeMode}
        effectiveDioramaCategory={theme.effectiveDioramaCategory}
        onSelectScene={handleSelectScene}
        onSelectSplitPreset={layout.handleSelectSplitPreset}
        onSelectEditorMode={layout.handleSelectEditorMode}
        onResetLayout={layout.handleResetLayout}
        onUploadFiles={menuFileDrop.processFiles}
        activeSkinsCount={stageSkins.activeSkinsCount}
        onClearAllSkins={stageSkins.clearAllSkins}
        onExportActiveScore={handleExportActiveScore}
        onOpenVideoExport={() => {
          mediaClock.pause();
          stageLoop.forceSyncUi();
          setIsVideoExportOpen(true);
        }}
        onOpenStoryboard={() => {
          mediaClock.pause();
          stageLoop.forceSyncUi();
          setIsStoryboardOpen(true);
        }}
        onOpenLibrary={(tab) => {
          setLibraryInitialTab(tab);
          setIsLibraryOpen(true);
        }}
        onOpenInfo={() => setIsInfoOpen(true)}
        onSelectThemeMode={theme.setThemeMode}
        onSelectDioramaThemeMode={theme.setDioramaThemeMode}
        onCreateBlankProject={async () => {
          const blank = await scorePersistence.createBlankScore();
          if (blank) {
            showToast(`Created new blank score "${blank.title}"`, 'success');
          }
        }}
      />

      {/* Main Resizable Split Workspace (Video Panel + 3D Blueprint Diorama + YAML Studio) */}
      <ResizableSplitWorkspace
        aspectRatio={doc.effectiveScore.aspectRatio}
        splitPreset={layout.splitPreset}
        isEditMode={layout.isEditMode}
        leftSplitPct={layout.leftSplitPct}
        onLeftSplitChange={layout.handleLeftSplitChange}
        rightSplitPct={layout.rightSplitPct}
        onRightSplitChange={layout.handleRightSplitChange}
        videoHeightPct={layout.videoHeightPct}
        onVideoHeightChange={layout.handleVideoHeightChange}
        isSubpanelCollapsed={layout.isSubpanelCollapsed}
        leftVideoPane={
          <div
            onDragEnter={videoDrop.handleDragEnter}
            onDragOver={videoDrop.handleDragOver}
            onDragLeave={videoDrop.handleDragLeave}
            onDrop={videoDrop.handleDrop}
            className="relative w-full h-full"
          >
            <UniversalVideoViewport
              score={doc.effectiveScore}
              sourceInfo={mediaClock.sourceInfo}
              html5VideoRef={mediaClock.html5VideoRef}
              youtubeContainerRef={mediaClock.youtubeContainerRef}
              frameRef={stageLoop.frameRef}
              uiFrame={stageLoop.uiSnapshot.frame}
              isPlaying={mediaClock.isPlaying}
              labelMode={display.labelMode}
              stageDisplay={display.stageDisplay}
              showGuides={display.showGuides}
              dofBlurEnabled={display.dofBlurEnabled}
              onToggleDofBlur={display.handleToggleDofBlur}
              themeCategory={theme.effectiveDioramaCategory}
              stageSkinUrl={stageSkins.stageSkin?.url ?? null}
              stageSkinVisible={stageSkins.isSkinsVisible}
              entitySkinUrls={stageSkins.entitySkinUrls}
              disableIframePointerEvents={isFileDragActive}
              onApplyVideoUrlOverride={(url) => {
                setVideoOverrideUrl(url);
                mediaClock.seek(0);
                showToast('Applied custom video URL override', 'info');
              }}
            />

            {/* Video Pane Scoped Drop Overlay */}
            {videoDrop.isDraggingOver && (
              <div className="absolute inset-0 z-40 bg-overlay-heavy/90 backdrop-blur-sm border-2 border-dashed border-sky-400 rounded-xl m-1 flex flex-col items-center justify-center gap-1.5 px-4 text-center pointer-events-none">
                <span className="text-sm font-mono font-bold text-text-main">
                  Drop Reference Video
                </span>
                <span className="text-[11px] font-mono text-text-muted">
                  .MP4, .WEBM or .MOV · Loaded in session memory
                </span>
              </div>
            )}
          </div>
        }
        leftSubpanelPane={
          <VideoWorkspaceSubpanel
            isCollapsed={layout.isSubpanelCollapsed}
            onToggleCollapse={layout.handleToggleSubpanelCollapse}
            score={doc.effectiveScore}
            activeShot={stageLoop.uiSnapshot.frame.activeShot}
            shotIndex={stageLoop.uiSnapshot.frame.shotIndex}
            hasVideoAttached={mediaClock.sourceInfo.kind !== 'procedural'}
            viewMode={subpanelViewMode}
            onSelectViewMode={setSubpanelViewMode}
            stageCamSlot={
              mediaClock.sourceInfo.kind !== 'procedural' ? (
                <StageCamMonitorCanvas
                  score={doc.effectiveScore}
                  frameRef={stageLoop.frameRef}
                  uiFrame={stageLoop.uiSnapshot.frame}
                  labelMode={display.labelMode}
                  stageDisplay={display.stageDisplay}
                  isPlaying={mediaClock.isPlaying}
                  showGuides={display.showGuides}
                  dofBlurEnabled={display.dofBlurEnabled}
                  onToggleDofBlur={display.handleToggleDofBlur}
                  themeCategory={theme.effectiveDioramaCategory}
                  stageSkinUrl={stageSkins.stageSkin?.url ?? null}
                  stageSkinVisible={stageSkins.isSkinsVisible}
                  entitySkinUrls={stageSkins.entitySkinUrls}
                  dpr={1}
                />
              ) : undefined
            }
            mapSlot={
              <DioramaMinimap
                variant="panel"
                score={doc.effectiveScore}
                frameRef={stageLoop.frameRef}
                liveViewportPoseRef={stageLoop.liveViewportPoseRef}
                uiFrame={stageLoop.uiSnapshot.frame}
                liveViewportPose={stageLoop.uiSnapshot.liveViewportPose}
                cameraMode={stageLoop.cameraMode}
                isPlaying={mediaClock.isPlaying}
              />
            }
          />
        }
        centerStagePane={
          <div
            ref={stageContainerRef}
            onDragEnter={dioramaDrop.handleDragEnter}
            onDragOver={dioramaDrop.handleDragOver}
            onDragLeave={dioramaDrop.handleDragLeave}
            onDrop={dioramaDrop.handleDrop}
            className="relative w-full h-full isolate"
          >
            {/* 3D React Three Fiber Blueprint Diorama */}
            <DioramaCanvas
              score={doc.effectiveScore}
              cameraMode={stageLoop.cameraMode}
              isPlaying={mediaClock.isPlaying}
              frameRef={stageLoop.frameRef}
              uiFrame={stageLoop.uiSnapshot.frame}
              lastManualSeekIdRef={mediaClock.lastManualSeekIdRef}
              evaluateTick60fps={stageLoop.evaluateTick60fps}
              onFreeOrbitPoseChange={stageLoop.notifyFreeOrbitChange}
              labelMode={display.labelMode}
              stageDisplay={display.stageDisplay}
              dofBlurEnabled={display.dofBlurEnabled}
              themeCategory={theme.effectiveDioramaCategory}
              cameraPresetActionRef={cameraPresetActionRef}
              cameraPresetSeq={cameraPresetSeq}
              sceneResetSeq={sceneResetSeq}
              stageSkinUrl={stageSkins.stageSkin?.url ?? null}
              stageSkinVisible={stageSkins.isSkinsVisible}
              entitySkinUrls={stageSkins.entitySkinUrls}
              onStageSkinError={stageSkins.handleStageSkinError}
              onEntitySkinError={stageSkins.handleEntitySkinError}
            />

            {/* Responsive Diorama HUD Overlays & POV Viewfinder Dock */}
            <DioramaOverlayContainer
              score={doc.effectiveScore}
              frame={stageLoop.uiSnapshot.frame}
              frameRef={stageLoop.frameRef}
              liveViewportPose={stageLoop.uiSnapshot.liveViewportPose}
              liveViewportPoseRef={stageLoop.liveViewportPoseRef}
              cameraMode={stageLoop.cameraMode}
              isPlaying={mediaClock.isPlaying}
              labelMode={display.labelMode}
              stageDisplay={display.stageDisplay}
              showHud={display.showDioramaHud}
              showGuides={display.showGuides}
              dofBlurEnabled={display.dofBlurEnabled}
              showMinimap={display.showMinimap}
              isNarrow={isNarrowDiorama}
              dioramaWidth={dioramaWidth}
              stageSkin={stageSkins.stageSkin}
              entitySkins={stageSkins.entitySkins}
              isSkinsVisible={stageSkins.isSkinsVisible}
              onToggleSkinsVisible={stageSkins.toggleSkinsVisible}
              onClearStageSkin={stageSkins.clearStageSkin}
              onClearEntitySkin={stageSkins.clearEntitySkin}
              onClearAllSkins={stageSkins.clearAllSkins}
              onSetCameraMode={stageLoop.setCameraMode}
              onSelectPreset={handleSelectCameraPreset}
              onSelectLabelMode={display.handleSelectLabelMode}
              onSelectFloorMode={display.handleSelectFloorMode}
              onToggleStageDisplayFlag={display.handleToggleStageDisplayFlag}
              onToggleCharacterVisible={display.handleToggleCharacterVisible}
              onResetStageDisplay={display.handleResetStageDisplay}
              onToggleGuides={display.handleToggleGuides}
              onToggleDofBlur={display.handleToggleDofBlur}
              onToggleMinimap={display.handleToggleMinimap}
            />

            {/* Diorama Pane Scoped Drop Overlay */}
            {dioramaDrop.isDraggingOver && (
              <div className="absolute inset-0 z-40 bg-overlay-heavy/90 backdrop-blur-sm border-2 border-dashed border-emerald-400 rounded-xl m-1 flex flex-col items-center justify-center gap-1.5 px-4 text-center pointer-events-none">
                <span className="text-sm md:text-base font-mono font-bold text-text-main">
                  Drop .YAML Score or .GLB/.GLTF Skin
                </span>
                <span className="text-[11px] font-mono text-text-muted">
                  YAML saves in IndexedDB · .GLB/.GLTF skins stay in session memory
                </span>
              </div>
            )}
          </div>
        }
        rightEditorPane={
          <YamlStudioPanel
            isOpen={layout.isEditMode}
            editorMode={layout.editorMode}
            onChangeEditorMode={layout.openEditMode}
            sceneId={activeSceneId}
            rawYaml={doc.rawYaml}
            historyRevision={doc.historyRevision}
            canUndo={doc.canUndo}
            canRedo={doc.canRedo}
            visualIR={doc.visualIR}
            visualIRError={doc.visualIRError}
            entities={doc.activeScore.entities}
            activeShotId={stageLoop.uiSnapshot.frame.activeShot?.id ?? null}
            parseError={doc.parseError}
            parseWarning={doc.parseWarning}
            diagnostics={doc.parseDiagnostics}
            effectiveTheme={theme.effectiveCategory}
            storageStatus={scorePersistence.storageStatus}
            isBundled={isBundledSceneId(activeSceneId)}
            onChangeYaml={doc.commitYamlText}
            onVisualCommand={doc.applyVisualCommand}
            onScrubPreview={doc.updateScrubPreview}
            onTimingScrubPreview={doc.updateTimingScrubPreview}
            onCommitScrub={doc.commitScrub}
            onCancelScrub={doc.cancelScrub}
            onSeekToTime={handleVisualSeekToTime}
            getCurrentTimeSec={getCurrentTimeSec}
            onUndo={doc.undo}
            onRedo={doc.redo}
            onForkScore={handleForkScore}
            onClose={layout.closeEditMode}
          />
        }
      />

      {/* Bottom Directorial Transport Deck (Streamlined Timeline Controls) */}
      <DirectorialTransportBar
        score={doc.effectiveScore}
        frame={stageLoop.uiSnapshot.frame}
        durationSec={mediaClock.durationSec}
        isPlaying={mediaClock.isPlaying}
        playbackRate={mediaClock.playbackRate}
        isMuted={mediaClock.isMuted}
        loopActiveShot={mediaClock.loopActiveShot}
        isCapturingSnapshot={stageCamSnapshot.isCapturing}
        showDioramaHud={display.showDioramaHud}
        onTogglePlay={mediaClock.togglePlay}
        onPause={mediaClock.pause}
        onSeek={handleSeekAndSync}
        onStepFrames={handleStepFramesAndSync}
        onSetPlaybackRate={mediaClock.setPlaybackRate}
        onToggleMute={mediaClock.toggleMute}
        onToggleLoopActiveShot={mediaClock.toggleLoopActiveShot}
        onCaptureStageCamSnapshot={handleCaptureStageCamSnapshot}
        onToggleDioramaHud={display.handleToggleDioramaHud}
      />

      {/* Reset Confirmation Dialog Modal */}
      <ConfirmResetModal
        isOpen={scorePersistence.isResetModalOpen}
        sceneTitle={doc.activeScore.title}
        onConfirm={scorePersistence.confirmResetActiveScore}
        onCancel={() => scorePersistence.setIsResetModalOpen(false)}
      />

      {/* Remote Score Confirmation & Conflict Dialog Modal */}
      <ConfirmRemoteScoreModal
        isOpen={remoteModalState.isOpen}
        mode={remoteModalState.mode}
        targetUrl={remoteModalState.targetUrl}
        existingTitle={remoteModalState.existingItem?.title}
        sourceFileName={remoteModalState.sourceFileName}
        isLoading={remoteModalState.isLoading}
        onCancel={handleCloseRemoteModal}
        onConfirmImport={() => {
          if (remoteModalState.targetUrl) {
            handleExecuteRemoteImport(remoteModalState.targetUrl, false);
          }
        }}
        onKeepLocal={() => {
          if (remoteModalState.mode === 'file-conflict') {
            handleResolveFileConflict('keep');
          } else {
            handleCloseRemoteModal();
          }
        }}
        onOverwrite={() => {
          if (
            remoteModalState.mode === 'url-conflict' &&
            remoteModalState.targetUrl
          ) {
            handleExecuteRemoteImport(
              remoteModalState.targetUrl,
              false,
              remoteModalState.existingItem
            );
          } else if (remoteModalState.mode === 'file-conflict') {
            handleResolveFileConflict('overwrite');
          }
        }}
        onSaveAsCopy={() => {
          if (
            remoteModalState.mode === 'url-conflict' &&
            remoteModalState.targetUrl
          ) {
            handleExecuteRemoteImport(
              remoteModalState.targetUrl,
              true,
              remoteModalState.existingItem
            );
          } else if (remoteModalState.mode === 'file-conflict') {
            handleResolveFileConflict('copy');
          }
        }}
      />

      {/* Choreography Score Library Modal (Dedicated Mobile Sheet vs Desktop 2-Column Master-Detail) */}
      {isMobile ? (
        <MobileScoreLibraryModal
          isOpen={isLibraryOpen}
          catalog={catalog}
          activeSceneId={activeSceneId}
          initialTab={libraryInitialTab}
          onSelectScene={handleSelectScene}
          onClose={() => setIsLibraryOpen(false)}
        />
      ) : (
        <ScoreLibraryModal
          isOpen={isLibraryOpen}
          catalog={catalog}
          activeSceneId={activeSceneId}
          initialTab={libraryInitialTab}
          onSelectScene={handleSelectScene}
          onEnsureScoreLoaded={handleEnsureScoreLoaded}
          onCreateBlankScore={async () => {
            const blank = await scorePersistence.createBlankScore();
            if (blank) {
              showToast(`Created new blank score "${blank.title}"`, 'success');
            }
          }}
          onForkScore={async (item) => {
            const custom = await scorePersistence.forkScoreAsCustom(item.id);
            if (custom) {
              showToast(
                `Forked "${item.title}" into editable Custom Project`,
                'success'
              );
            }
          }}
          onDuplicateScore={async (id) => {
            const item = catalog.find((c) => c.id === id);
            if (item) {
              const dupe = await scorePersistence.forkScoreAsCustom(item.id);
              if (dupe) {
                showToast(`Duplicated "${item.title}"`, 'success');
              }
            }
          }}
          onExportScore={handleExportScore}
          onRenameScore={async (id, newTitle) => {
            const ok = await scorePersistence.renameCustomScore(id, newTitle);
            if (ok) {
              showToast(`Renamed score to "${newTitle}"`, 'success');
            }
            return ok;
          }}
          onDeleteScore={async (id) => {
            const ok = await scorePersistence.deleteCustomScore(id);
            if (ok) {
              showToast('Custom project deleted', 'info');
            }
            return ok;
          }}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}

      {/* About & Studio Info Modal */}
      <AppInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />

      {/* In-Browser Clean Stage Cam & Observer MP4 Export Modal */}
      <CleanVideoExportModal
        isOpen={isVideoExportOpen}
        score={doc.activeScore}
        activeShot={stageLoop.uiSnapshot.frame.activeShot}
        liveViewportPose={stageLoop.uiSnapshot.liveViewportPose}
        dofBlurEnabled={display.dofBlurEnabled}
        stageSkinUrl={stageSkins.effectiveStageSkinUrl}
        entitySkinUrls={stageSkins.effectiveEntitySkinUrls}
        onNotify={showToast}
        onClose={() => setIsVideoExportOpen(false)}
      />

      {/* Storyboard Contact Sheet Generator & Viewer Modal */}
      <StoryboardModal
        isOpen={isStoryboardOpen}
        score={doc.activeScore}
        dofBlurEnabled={display.dofBlurEnabled}
        stageSkinUrl={stageSkins.effectiveStageSkinUrl}
        entitySkinUrls={stageSkins.effectiveEntitySkinUrls}
        onNotify={showToast}
        onClose={() => setIsStoryboardOpen(false)}
      />

      {/* Direct Target Assignment Modal for Dropped / Picked .GLB / .GLTF Skins */}
      <AssignStageSkinModal
        pendingDrops={stageSkins.pendingSkinQueue}
        entities={doc.activeScore.entities}
        stageSkin={stageSkins.stageSkin}
        entitySkins={stageSkins.entitySkins}
        onAssign={stageSkins.assignPendingSkin}
        onAssignBatch={stageSkins.assignPendingBatch}
        onCancel={stageSkins.cancelPendingSkin}
        onCancelAll={stageSkins.cancelAllPendingSkins}
      />

      {/* Temporary Offscreen Stage Cam Snapshot Canvas (mounted strictly during 1-frame capture) */}
      {stageCamSnapshot.pendingRequest && (
        <CleanStageCamExportCanvas
          ref={stageCamSnapshot.canvasRef}
          score={stageCamSnapshot.pendingRequest.score}
          initialFrame={stageCamSnapshot.pendingRequest.frame}
          width={stageCamSnapshot.pendingRequest.width}
          height={stageCamSnapshot.pendingRequest.height}
          dofBlurEnabled={stageCamSnapshot.pendingRequest.dofBlurEnabled}
          themeCategory={stageCamSnapshot.pendingRequest.themeCategory}
          targetCamera="stage-cam"
          stageSkinUrl={stageCamSnapshot.pendingRequest.stageSkinUrl}
          entitySkinUrls={stageCamSnapshot.pendingRequest.entitySkinUrls}
        />
      )}

      {/* Floating Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default InteractiveStudioApp;

