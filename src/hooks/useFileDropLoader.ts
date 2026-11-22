/**
 * Hook for handling pane-scoped drag-and-drop (files and folders) or file-picker
 * loading of `.yaml` scores, `.mp4`/`.webm`/`.mov` videos, and `.glb`/`.gltf` 3D skins.
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

function readFileEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });
}

async function readDirectoryEntry(
  dirEntry: FileSystemDirectoryEntry
): Promise<File[]> {
  const reader = dirEntry.createReader();
  const childEntries: FileSystemEntry[] = [];

  // Chromium readEntries returns at most ~100 entries per call until an empty array is returned
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(
        (results) => resolve(results),
        () => resolve([])
      );
    });
    if (batch.length === 0) break;
    childEntries.push(...batch);
  }

  childEntries.sort((a, b) => a.name.localeCompare(b.name));

  const collected: File[] = [];
  for (const child of childEntries) {
    const nested = await collectEntryFiles(child);
    collected.push(...nested);
  }
  return collected;
}

async function collectEntryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry);
    return file ? [file] : [];
  }
  if (entry.isDirectory) {
    return readDirectoryEntry(entry as FileSystemDirectoryEntry);
  }
  return [];
}

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
    async (
      files: FileList | File[],
      options?: { ignoreUnsupportedWhenAccepted?: boolean }
    ) => {
      const fileArray = Array.from(files);
      const rejectedKinds: DroppedAssetKind[] = [];
      let acceptedCount = 0;

      for (const file of fileArray) {
        const kind = classifyDroppedAsset(file.name, file.type);
        if (kind === 'unsupported' || !acceptedKinds.includes(kind)) {
          if (!rejectedKinds.includes(kind)) {
            rejectedKinds.push(kind);
          }
          continue;
        }

        acceptedCount += 1;
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

      const filteredRejected =
        options?.ignoreUnsupportedWhenAccepted && acceptedCount > 0
          ? rejectedKinds.filter((kind) => kind !== 'unsupported')
          : rejectedKinds;

      if (filteredRejected.length > 0) {
        onRejectedFiles?.(filteredRejected);
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

      const dataTransfer = e.dataTransfer;
      if (!dataTransfer) return;

      // Extract entries synchronously before the browser clears DataTransfer after return
      const rawItems = dataTransfer.items ? Array.from(dataTransfer.items) : [];
      const entries = rawItems
        .map((item) => item.webkitGetAsEntry?.() ?? null)
        .filter((entry): entry is FileSystemEntry => entry !== null);
      const hasDirectory = entries.some((entry) => entry.isDirectory);

      if (hasDirectory) {
        void (async () => {
          const collected: File[] = [];
          for (const entry of entries) {
            const nested = await collectEntryFiles(entry);
            collected.push(...nested);
          }
          await processFiles(collected, {
            ignoreUnsupportedWhenAccepted: true,
          });
        })();
        return;
      }

      if (dataTransfer.files && dataTransfer.files.length > 0) {
        void processFiles(dataTransfer.files);
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
