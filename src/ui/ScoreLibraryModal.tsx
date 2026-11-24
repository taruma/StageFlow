/**
 * Accessible Score Library Modal for StageFlow.
 * Features a full-width 3-column compact grid by default, Custom-first section priority,
 * build-time/IndexedDB Recency & metric sorting with direction toggle, media/aspect filters,
 * 2D keyboard navigation, and an on-demand Details Inspector sidecar.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Clapperboard, Plus, X } from 'lucide-react';
import type { ScoreCatalogItem } from '../core/scoreCatalog';
import type {
  LibraryAspectFilter,
  LibraryFilterTab,
  LibrarySortDirection,
  LibrarySortField,
  LibrarySourceFilter,
} from '../core/types';
import {
  classifyScoreAspectBucket,
  filterScoreCatalog,
  getDefaultSortDirection,
  hasActiveLibraryFilters,
  sortScoreCatalog,
} from '../core/scoreCatalogFilters';
import {
  loadStoredLibraryBlueprintExpanded,
  loadStoredLibraryCustomExpanded,
  loadStoredLibraryShowDetails,
  loadStoredLibrarySortDirection,
  loadStoredLibrarySortField,
  loadStoredLibraryStudyExpanded,
  loadStoredLibraryTab,
  saveStoredLibraryBlueprintExpanded,
  saveStoredLibraryCustomExpanded,
  saveStoredLibraryShowDetails,
  saveStoredLibrarySortDirection,
  saveStoredLibrarySortField,
  saveStoredLibraryStudyExpanded,
  saveStoredLibraryTab,
} from '../core/storage/localStorageUi';
import { ScoreLibraryToolbar } from './library/ScoreLibraryToolbar';
import {
  ScoreLibraryGridBody,
  type ScoreLibrarySectionGroup,
} from './library/ScoreLibraryGridBody';
import { ScoreLibraryFooter } from './library/ScoreLibraryFooter';
import { ScoreInspectorPane } from './library/ScoreInspectorPane';
import { useScoreLibraryKeyboard } from './library/useScoreLibraryKeyboard';
import { UI_TOKENS } from './tokens/ui';

export type FilterTab = LibraryFilterTab;

export interface ScoreLibraryModalProps {
  isOpen: boolean;
  catalog: ScoreCatalogItem[];
  activeSceneId: string;
  initialTab?: FilterTab;
  onSelectScene: (sceneId: string) => void;
  onEnsureScoreLoaded: (sceneId: string) => void | Promise<void>;
  onCreateBlankScore?: () => void;
  onForkScore?: (item: ScoreCatalogItem) => void;
  onDuplicateScore?: (id: string) => void;
  onExportScore?: (item: ScoreCatalogItem) => void;
  onRenameScore?: (id: string, newTitle: string) => Promise<boolean>;
  onDeleteScore?: (id: string) => Promise<boolean>;
  onClose: () => void;
}

export const ScoreLibraryModal: React.FC<ScoreLibraryModalProps> = ({
  isOpen,
  catalog,
  activeSceneId,
  initialTab,
  onSelectScene,
  onEnsureScoreLoaded,
  onCreateBlankScore,
  onForkScore,
  onDuplicateScore,
  onExportScore,
  onRenameScore,
  onDeleteScore,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>(
    () => initialTab ?? loadStoredLibraryTab() ?? 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<LibrarySourceFilter>('all');
  const [aspectFilter, setAspectFilter] = useState<LibraryAspectFilter>('all');
  const [sortField, setSortField] = useState<LibrarySortField>(
    () => loadStoredLibrarySortField() ?? 'recent'
  );
  const [sortDirection, setSortDirection] = useState<LibrarySortDirection>(
    () =>
      loadStoredLibrarySortDirection() ??
      getDefaultSortDirection(loadStoredLibrarySortField() ?? 'recent')
  );
  const [showDetails, setShowDetails] = useState<boolean>(
    () => loadStoredLibraryShowDetails() ?? false
  );
  const [selectedScoreId, setSelectedScoreId] = useState<string>(activeSceneId);

  const [isCustomExpanded, setIsCustomExpanded] = useState<boolean>(
    () => loadStoredLibraryCustomExpanded() ?? true
  );
  const [isStudyExpanded, setIsStudyExpanded] = useState<boolean>(
    () => loadStoredLibraryStudyExpanded() ?? true
  );
  const [isBlueprintExpanded, setIsBlueprintExpanded] = useState<boolean>(
    () => loadStoredLibraryBlueprintExpanded() ?? false
  );

  const listContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelectTab = (tab: FilterTab) => {
    setActiveTab(tab);
    saveStoredLibraryTab(tab);
  };

  const handleToggleDetails = useCallback(() => {
    setShowDetails((prev) => {
      const next = !prev;
      saveStoredLibraryShowDetails(next);
      return next;
    });
  }, []);

  const handleSelectSortField = (field: LibrarySortField) => {
    if (field === sortField) {
      const nextDir: LibrarySortDirection =
        sortDirection === 'desc' ? 'asc' : 'desc';
      setSortDirection(nextDir);
      saveStoredLibrarySortDirection(nextDir);
      return;
    }
    const defaultDir = getDefaultSortDirection(field);
    setSortField(field);
    setSortDirection(defaultDir);
    saveStoredLibrarySortField(field);
    saveStoredLibrarySortDirection(defaultDir);
  };

  const handleToggleSortDirection = () => {
    setSortDirection((prev) => {
      const next: LibrarySortDirection = prev === 'desc' ? 'asc' : 'desc';
      saveStoredLibrarySortDirection(next);
      return next;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setAspectFilter('all');
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab ?? loadStoredLibraryTab() ?? 'all');
      setSelectedScoreId(activeSceneId);
    }
  }, [isOpen, initialTab, activeSceneId]);

  const counts = useMemo(
    () => ({
      all: catalog.length,
      custom: catalog.filter((i) => i.category === 'custom' || i.isCustom).length,
      study: catalog.filter((i) => i.category === 'study').length,
      blueprint: catalog.filter((i) => i.category === 'blueprint').length,
    }),
    [catalog]
  );

  const hasOtherAspect = useMemo(
    () =>
      catalog.some((i) => classifyScoreAspectBucket(i.aspectRatio) === 'other'),
    [catalog]
  );

  const filtersActive = hasActiveLibraryFilters({
    query: searchQuery,
    source: sourceFilter,
    aspect: aspectFilter,
  });

  const sortedFilteredScores = useMemo(
    () =>
      sortScoreCatalog(
        filterScoreCatalog(catalog, {
          tab: activeTab,
          query: searchQuery,
          source: sourceFilter,
          aspect: aspectFilter,
        }),
        sortField,
        sortDirection
      ),
    [catalog, activeTab, searchQuery, sourceFilter, aspectFilter, sortField, sortDirection]
  );

  const sections = useMemo<ScoreLibrarySectionGroup[]>(() => {
    const customItems = sortedFilteredScores.filter(
      (i) => i.category === 'custom' || i.isCustom
    );
    const studyItems = sortedFilteredScores.filter((i) => i.category === 'study');
    const blueprintItems = sortedFilteredScores.filter(
      (i) => i.category === 'blueprint'
    );

    return [
      {
        key: 'custom',
        label: 'Custom Projects',
        items: customItems,
        expanded: filtersActive || isCustomExpanded,
        badgeClass:
          'bg-amber-500/15 border-amber-400/30 text-amber-600 dark:text-amber-300',
        onToggle: () =>
          setIsCustomExpanded((p) => {
            const next = !p;
            saveStoredLibraryCustomExpanded(next);
            return next;
          }),
      },
      {
        key: 'study',
        label: 'Scene Studies',
        items: studyItems,
        expanded: filtersActive || isStudyExpanded,
        badgeClass:
          'bg-violet-500/15 border-violet-400/30 text-violet-600 dark:text-violet-300',
        onToggle: () =>
          setIsStudyExpanded((p) => {
            const next = !p;
            saveStoredLibraryStudyExpanded(next);
            return next;
          }),
      },
      {
        key: 'blueprint',
        label: 'Blueprints',
        items: blueprintItems,
        expanded: filtersActive || isBlueprintExpanded,
        badgeClass:
          'bg-sky-500/15 border-sky-400/30 text-sky-600 dark:text-sky-300',
        onToggle: () =>
          setIsBlueprintExpanded((p) => {
            const next = !p;
            saveStoredLibraryBlueprintExpanded(next);
            return next;
          }),
      },
    ];
  }, [
    sortedFilteredScores,
    filtersActive,
    isCustomExpanded,
    isStudyExpanded,
    isBlueprintExpanded,
  ]);

  const visibleScores = useMemo(
    () =>
      activeTab !== 'all'
        ? sortedFilteredScores
        : sections.flatMap((s) => (s.expanded ? s.items : [])),
    [activeTab, sortedFilteredScores, sections]
  );

  const selectedScore = useMemo(
    () =>
      sortedFilteredScores.find((i) => i.id === selectedScoreId) ??
      visibleScores[0] ??
      sortedFilteredScores[0] ??
      catalog.find((i) => i.id === selectedScoreId) ??
      catalog[0] ??
      null,
    [sortedFilteredScores, selectedScoreId, visibleScores, catalog]
  );

  // Zero-waste lazy load: only parse full YAML when the Details Inspector is open
  useEffect(() => {
    if (
      isOpen &&
      showDetails &&
      selectedScore &&
      !selectedScore.isCustom &&
      !selectedScore.score
    ) {
      void onEnsureScoreLoaded(selectedScore.id);
    }
  }, [isOpen, showDetails, selectedScore, onEnsureScoreLoaded]);

  const loadScoreAndClose = useCallback(
    (scoreId: string) => {
      onSelectScene(scoreId);
      onClose();
    },
    [onSelectScene, onClose]
  );

  useScoreLibraryKeyboard({
    isOpen,
    showDetails,
    searchQuery,
    visibleScores,
    selectedScore,
    listContainerRef,
    searchInputRef,
    onSelectScoreId: setSelectedScoreId,
    onLoadScore: loadScoreAndClose,
    onToggleDetails: handleToggleDetails,
    onClearSearch: () => setSearchQuery(''),
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="score-library-title"
      className={UI_TOKENS.modal.overlay}
      onClick={onClose}
    >
      <div
        className={UI_TOKENS.modal.containerLibrary}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={UI_TOKENS.modal.header}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-surface-muted border border-border-main flex items-center justify-center text-text-main shrink-0 shadow-2xs">
              <Clapperboard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="score-library-title"
                className="text-sm sm:text-base font-bold font-sans text-text-main tracking-tight leading-none"
              >
                Choreography Score Library
              </h2>
              <span className="text-[11px] font-sans text-text-muted truncate block mt-1">
                Click to select · Double-click or{' '}
                <kbd className="font-mono text-[10px] px-1 rounded bg-surface border border-border-subtle">
                  Enter
                </kbd>{' '}
                to load ·{' '}
                <kbd className="font-mono text-[10px] px-1 rounded bg-surface border border-border-subtle">
                  I
                </kbd>{' '}
                details
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onCreateBlankScore && (
              <button
                type="button"
                onClick={() => {
                  onCreateBlankScore();
                  onClose();
                }}
                className={UI_TOKENS.button.actionPill}
                title="Create a new blank choreography score"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Blank</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close score library"
              className={UI_TOKENS.button.iconClose}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ScoreLibraryToolbar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          counts={counts}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          aspectFilter={aspectFilter}
          onAspectFilterChange={setAspectFilter}
          hasOtherAspect={hasOtherAspect}
          sortField={sortField}
          sortDirection={sortDirection}
          onSelectSortField={handleSelectSortField}
          onToggleSortDirection={handleToggleSortDirection}
          showDetails={showDetails}
          onToggleDetails={handleToggleDetails}
          hasActiveFilters={filtersActive}
          onResetFilters={handleResetFilters}
        />

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <ScoreLibraryGridBody
            activeTab={activeTab}
            showDetails={showDetails}
            sections={sections}
            sortedFilteredScores={sortedFilteredScores}
            activeSceneId={activeSceneId}
            selectedScoreId={selectedScore?.id ?? null}
            filtersActive={filtersActive}
            listContainerRef={listContainerRef}
            onSelectScore={setSelectedScoreId}
            onLoadScore={loadScoreAndClose}
            onInspectScore={(id) => {
              setSelectedScoreId(id);
              if (!showDetails) {
                setShowDetails(true);
                saveStoredLibraryShowDetails(true);
              }
            }}
            onResetFilters={handleResetFilters}
          />

          {showDetails && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface">
              {selectedScore ? (
                <ScoreInspectorPane
                  item={selectedScore}
                  isActive={selectedScore.id === activeSceneId}
                  onSelectScore={() => loadScoreAndClose(selectedScore.id)}
                  onForkScore={onForkScore}
                  onDuplicateScore={onDuplicateScore}
                  onExportScore={onExportScore}
                  onRenameScore={onRenameScore}
                  onDeleteScore={onDeleteScore}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted">
                  <Clapperboard className="w-10 h-10 stroke-1 text-text-faint mb-3" />
                  <span className="text-sm font-sans font-medium">
                    No score selected
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {!showDetails && (
          <ScoreLibraryFooter
            item={selectedScore}
            isActive={selectedScore?.id === activeSceneId}
            onSelectScore={() => {
              if (selectedScore) loadScoreAndClose(selectedScore.id);
            }}
            onForkScore={onForkScore}
            onDuplicateScore={onDuplicateScore}
            onExportScore={onExportScore}
            onRenameScore={onRenameScore}
            onDeleteScore={onDeleteScore}
          />
        )}
      </div>
    </div>
  );
};
