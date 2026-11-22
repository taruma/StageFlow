/**
 * Hook for handling pane-scoped drag-and-drop or file-picker loading of
 * `.yaml` scores, `.mp4`/`.webm`/`.mov` videos, and `.glb`/`.gltf` 3D skins.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  classifyDroppedAsset,
  hasFilesInDataTransfer,
  type DroppedAssetKind,
} from '../core/fileDropClassifier';

const DEFAULT_ACCEPTED_KINDS: readonly DroppedAssetKind[] = [
  'yaml',
  'video',
  'skin',
];

export interface UseFileDropLoaderOptions {
  acceptedKinds?: readonly DroppedAssetKind[];
  onLoadYamlText?: (rawYaml: string, fileName: string) => void;
  onLoadVideoBlobUrl?: (blobUrl: string, fileName: string) => void;
  onLoadStageSkinBlobUrl?: (blobUrl: string, fileName: string) => void;
  onRejectedFiles?: (rejectedKinds: DroppedAssetKind[]) => void;
}

export function useFileDropLoader({
  acceptedKinds = DEFAULT_ACCEPTED_KINDS,
  onLoadYamlText,
  onLoadVideoBlobUrl,
  onLoadStageSkinBlobUrl,
  onRejectedFiles,
}: UseFileDropLoaderOptions) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
  }, []);

  useEffect(() => {
    const handleWindowDragEnd = () => {
      resetDragState();
    };
    window.addEventListener('dragend', handleWindowDragEnd);
    return () => window.removeEventListener('dragend', handleWindowDragEnd);
  }, [resetDragState]);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const rejectedKinds: DroppedAssetKind[] = [];

      for (const file of fileArray) {
        const kind = classifyDroppedAsset(file.name, file.type);
        if (kind === 'unsupported' || !acceptedKinds.includes(kind)) {
          if (!rejectedKinds.includes(kind)) {
            rejectedKinds.push(kind);
          }
          continue;
        }

        if (kind === 'yaml') {
          const text = await file.text();
          onLoadYamlText?.(text, file.name);
        } else if (kind === 'video') {
          const blobUrl = URL.createObjectURL(file);
          onLoadVideoBlobUrl?.(blobUrl, file.name);
        } else if (kind === 'skin') {
          const blobUrl = URL.createObjectURL(file);
          onLoadStageSkinBlobUrl?.(blobUrl, file.name);
        }
      }

      if (rejectedKinds.length > 0) {
        onRejectedFiles?.(rejectedKinds);
      }
    },
    [
      acceptedKinds,
      onLoadYamlText,
      onLoadVideoBlobUrl,
      onLoadStageSkinBlobUrl,
      onRejectedFiles,
    ]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasFilesInDataTransfer(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingOver(true);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!hasFilesInDataTransfer(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      if (!isDraggingOver) {
        setIsDraggingOver(true);
      }
    },
    [isDraggingOver]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFilesInDataTransfer(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasFilesInDataTransfer(e.dataTransfer)) return;
      e.preventDefault();
      e.stopPropagation();
      resetDragState();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        void processFiles(e.dataTransfer.files);
      }
    },
    [processFiles, resetDragState]
  );

  return {
    isDraggingOver,
    processFiles,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
