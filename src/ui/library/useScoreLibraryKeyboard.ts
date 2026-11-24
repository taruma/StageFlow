/**
 * Keyboard navigation & scroll-into-view hook for ScoreLibraryModal.
 * Handles '/', 'I', 'Escape', 'Enter', and 2D grid ArrowLeft/Right/Up/Down traversal.
 */

import { useEffect, type RefObject } from 'react';
import type { ScoreCatalogItem } from '../../core/scoreCatalog';

export interface UseScoreLibraryKeyboardOptions {
  isOpen: boolean;
  showDetails: boolean;
  searchQuery: string;
  visibleScores: ScoreCatalogItem[];
  selectedScore: ScoreCatalogItem | null;
  listContainerRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSelectScoreId: (id: string) => void;
  onLoadScore: (id: string) => void;
  onToggleDetails: () => void;
  onClearSearch: () => void;
  onClose: () => void;
}

export function useScoreLibraryKeyboard({
  isOpen,
  showDetails,
  searchQuery,
  visibleScores,
  selectedScore,
  listContainerRef,
  searchInputRef,
  onSelectScoreId,
  onLoadScore,
  onToggleDetails,
  onClearSearch,
  onClose,
}: UseScoreLibraryKeyboardOptions): void {
  // Keep keyboard-selected card scrolled into view
  useEffect(() => {
    if (!isOpen || !listContainerRef.current || !selectedScore?.id) return;
    const cards =
      listContainerRef.current.querySelectorAll<HTMLElement>('[data-score-id]');
    for (const card of cards) {
      if (card.dataset.scoreId === selectedScore.id) {
        card.scrollIntoView({ block: 'nearest' });
        break;
      }
    }
  }, [isOpen, listContainerRef, selectedScore?.id]);

  useEffect(() => {
    if (!isOpen) return;

    const getGridColumnCount = (): number => {
      const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
      if (showDetails) {
        return w >= 1280 ? 2 : 1;
      }
      if (w >= 1024) return 3;
      if (w >= 640) return 2;
      return 1;
    };

    const handleKeyNav = (e: KeyboardEvent) => {
      const isInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement;

      if (e.key === 'Escape') {
        if (
          e.target === searchInputRef.current &&
          searchQuery.trim().length > 0
        ) {
          e.preventDefault();
          onClearSearch();
          return;
        }
        onClose();
        return;
      }

      if (isInput) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        onToggleDetails();
        return;
      }

      if (e.key === 'Enter') {
        if (selectedScore) {
          e.preventDefault();
          onLoadScore(selectedScore.id);
        }
        return;
      }

      if (visibleScores.length === 0) return;

      const activeId = selectedScore?.id ?? '';
      const currentIdx = Math.max(
        0,
        visibleScores.findIndex((s) => s.id === activeId)
      );
      const cols = getGridColumnCount();

      let nextIdx: number | null = null;
      if (e.key === 'ArrowRight') {
        nextIdx = Math.min(visibleScores.length - 1, currentIdx + 1);
      } else if (e.key === 'ArrowLeft') {
        nextIdx = Math.max(0, currentIdx - 1);
      } else if (e.key === 'ArrowDown') {
        nextIdx = Math.min(visibleScores.length - 1, currentIdx + cols);
      } else if (e.key === 'ArrowUp') {
        nextIdx = Math.max(0, currentIdx - cols);
      }

      if (nextIdx !== null) {
        e.preventDefault();
        onSelectScoreId(visibleScores[nextIdx].id);
      }
    };

    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [
    isOpen,
    showDetails,
    searchQuery,
    visibleScores,
    selectedScore,
    searchInputRef,
    onSelectScoreId,
    onLoadScore,
    onToggleDetails,
    onClearSearch,
    onClose,
  ]);
}
