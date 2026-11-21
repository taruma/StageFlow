/**
 * Ephemeral Session Skin Manager Hook (.glb / .gltf).
 * Tracks stage environment skin + per-entity (character/prop/marker) skins,
 * handles drag-and-drop assignment queue, visibility toggles, and blob URL cleanup.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { suggestSkinTargetId } from '../core/skinMath';
import type { SceneEntityDef, ToastNotification } from '../core/types';

export interface ActiveSkinEntry {
  url: string;
  name: string;
}

export interface PendingSkinDrop {
  url: string;
  name: string;
  suggestedTargetId: string;
}

export interface UseStageSkinsOptions {
  entities: SceneEntityDef[];
  onPreloadSkin?: (url: string) => void;
  onReleaseSkinCache?: (url: string) => void;
  onNotify?: (message: string, type?: ToastNotification['type']) => void;
}

export function useStageSkins({
  entities,
  onPreloadSkin,
  onReleaseSkinCache,
  onNotify,
}: UseStageSkinsOptions) {
  const [stageSkin, setStageSkin] = useState<ActiveSkinEntry | null>(null);
  const [entitySkins, setEntitySkins] = useState<
    Record<string, ActiveSkinEntry>
  >({});
  const [isSkinsVisible, setIsSkinsVisible] = useState(true);
  const [pendingQueue, setPendingQueue] = useState<PendingSkinDrop[]>([]);

  const stageSkinRef = useRef<ActiveSkinEntry | null>(null);
  const entitySkinsRef = useRef<Record<string, ActiveSkinEntry>>({});
  const pendingQueueRef = useRef<PendingSkinDrop[]>([]);
  stageSkinRef.current = stageSkin;
  entitySkinsRef.current = entitySkins;
  pendingQueueRef.current = pendingQueue;

  const onPreloadRef = useRef(onPreloadSkin);
  const onReleaseRef = useRef(onReleaseSkinCache);
  const onNotifyRef = useRef(onNotify);
  onPreloadRef.current = onPreloadSkin;
  onReleaseRef.current = onReleaseSkinCache;
  onNotifyRef.current = onNotify;

  const releaseUrl = useCallback((url: string | null | undefined) => {
    if (!url) return;
    onReleaseRef.current?.(url);
    URL.revokeObjectURL(url);
  }, []);

  // Revoke all active and queued blob URLs on unmount
  useEffect(() => {
    return () => {
      if (stageSkinRef.current) {
        onReleaseRef.current?.(stageSkinRef.current.url);
        URL.revokeObjectURL(stageSkinRef.current.url);
      }
      for (const entry of Object.values(entitySkinsRef.current)) {
        onReleaseRef.current?.(entry.url);
        URL.revokeObjectURL(entry.url);
      }
      for (const item of pendingQueueRef.current) {
        onReleaseRef.current?.(item.url);
        URL.revokeObjectURL(item.url);
      }
    };
  }, []);

  const enqueueSkinDrop = useCallback(
    (blobUrl: string, fileName: string) => {
      onPreloadRef.current?.(blobUrl);
      const suggestedTargetId = suggestSkinTargetId(fileName, entities);
      setPendingQueue((prev) => [
        ...prev,
        { url: blobUrl, name: fileName, suggestedTargetId },
      ]);
    },
    [entities]
  );

  const assignPendingSkin = useCallback(
    (targetId: string) => {
      const current = pendingQueueRef.current[0];
      if (!current) return;

      setPendingQueue((prev) => prev.slice(1));
      setIsSkinsVisible(true);

      if (targetId === 'stage') {
        releaseUrl(stageSkinRef.current?.url);
        setStageSkin({ url: current.url, name: current.name });
        onNotifyRef.current?.(
          `Applied "${current.name}" to Stage Environment`,
          'success'
        );
        return;
      }

      const prevEntity = entitySkinsRef.current[targetId];
      releaseUrl(prevEntity?.url);
      setEntitySkins((prev) => ({
        ...prev,
        [targetId]: { url: current.url, name: current.name },
      }));

      const matched = entities.find((e) => e.id === targetId);
      const targetLabel = matched?.label || targetId;
      onNotifyRef.current?.(
        `Applied "${current.name}" to ${targetLabel}`,
        'success'
      );
    },
    [entities, releaseUrl]
  );

  const cancelPendingSkin = useCallback(() => {
    const current = pendingQueueRef.current[0];
    if (!current) return;
    setPendingQueue((prev) => prev.slice(1));
    releaseUrl(current.url);
  }, [releaseUrl]);

  const clearStageSkin = useCallback(() => {
    if (!stageSkinRef.current) return;
    releaseUrl(stageSkinRef.current.url);
    setStageSkin(null);
    onNotifyRef.current?.('Removed Stage Environment skin', 'info');
  }, [releaseUrl]);

  const clearEntitySkin = useCallback(
    (entityId: string) => {
      const existing = entitySkinsRef.current[entityId];
      if (!existing) return;
      releaseUrl(existing.url);
      setEntitySkins((prev) => {
        const next = { ...prev };
        delete next[entityId];
        return next;
      });
      onNotifyRef.current?.(`Removed skin from "${entityId}"`, 'info');
    },
    [releaseUrl]
  );

  const clearAllSkins = useCallback(() => {
    releaseUrl(stageSkinRef.current?.url);
    for (const entry of Object.values(entitySkinsRef.current)) {
      releaseUrl(entry.url);
    }
    setStageSkin(null);
    setEntitySkins({});
    onNotifyRef.current?.('Removed all 3D .glb skins', 'info');
  }, [releaseUrl]);

  const handleStageSkinError = useCallback(
    (error: Error) => {
      const failedName = stageSkinRef.current?.name ?? 'model';
      releaseUrl(stageSkinRef.current?.url);
      setStageSkin(null);
      onNotifyRef.current?.(
        `Failed to load 3D skin "${failedName}": ${error.message}`,
        'error'
      );
    },
    [releaseUrl]
  );

  const handleEntitySkinError = useCallback(
    (entityId: string, error: Error) => {
      const existing = entitySkinsRef.current[entityId];
      if (!existing) return;
      releaseUrl(existing.url);
      setEntitySkins((prev) => {
        const next = { ...prev };
        delete next[entityId];
        return next;
      });
      onNotifyRef.current?.(
        `Failed to load "${existing.name}" for ${entityId}: ${error.message}`,
        'error'
      );
    },
    [releaseUrl]
  );

  const toggleSkinsVisible = useCallback(() => {
    setIsSkinsVisible((prev) => !prev);
  }, []);

  const entitySkinUrls = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, entry] of Object.entries(entitySkins)) {
      map[id] = entry.url;
    }
    return map;
  }, [entitySkins]);

  const effectiveStageSkinUrl =
    isSkinsVisible && stageSkin ? stageSkin.url : null;

  const effectiveEntitySkinUrls = useMemo(() => {
    return isSkinsVisible ? entitySkinUrls : {};
  }, [isSkinsVisible, entitySkinUrls]);

  return {
    stageSkin,
    entitySkins,
    entitySkinUrls,
    effectiveStageSkinUrl,
    effectiveEntitySkinUrls,
    isSkinsVisible,
    pendingSkinDrop: pendingQueue[0] ?? null,
    enqueueSkinDrop,
    assignPendingSkin,
    cancelPendingSkin,
    clearStageSkin,
    clearEntitySkin,
    clearAllSkins,
    toggleSkinsVisible,
    handleStageSkinError,
    handleEntitySkinError,
  };
}
