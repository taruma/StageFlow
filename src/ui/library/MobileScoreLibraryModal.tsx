/**
 * MobileScoreLibraryModal Component.
 * Dedicated, full-screen mobile score switcher optimized for touch thumbs.
 * Features 1-tap direct scene loading, Custom-first section priority, search & sort controls,
 * horizontal swipeable category chips, and collapsed-by-default blueprints section.
 * Layer 5 UI Component.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Clapperboard,
  X,
  ChevronDown,
  Search,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from 'lucide-react';
import type { ScoreCatalogItem } from '../../core/scoreCatalog';
import type {
  LibrarySortDirection,
  LibrarySortField,
} from '../../core/types';
import {
  filterScoreCatalog,
  getDefaultSortDirection,
  sortScoreCatalog,
} from '../../core/scoreCatalogFilters';
import type { FilterTab } from '../ScoreLibraryModal';
import {
  loadStoredLibraryBlueprintExpanded,
  loadStoredLibraryCustomExpanded,
  loadStoredLibrarySortDirection,
  loadStoredLibrarySortField,
  loadStoredLibraryStudyExpanded,
  loadStoredLibraryTab,
  saveStoredLibraryBlueprintExpanded,
  saveStoredLibraryCustomExpanded,
  saveStoredLibrarySortDirection,
  saveStoredLibrarySortField,
  saveStoredLibraryStudyExpanded,
  saveStoredLibraryTab,
} from '../../core/storage/localStorageUi';
import { ScoreLibraryCard } from './ScoreLibraryCard';
import { UI_TOKENS } from '../tokens/ui';

export interface MobileScoreLibraryModalProps {
  isOpen: boolean;
  catalog: ScoreCatalogItem[];
  activeSceneId: string;
  initialTab?: FilterTab;
  onSelectScene: (sceneId: string) => void;
  onClose: () => void;
}

export const MobileScoreLibraryModal: React.FC<MobileScoreLibraryModalProps> = ({
  isOpen,
  catalog,
  activeSceneId,
  initialTab,
  onSelectScene,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<FilterTab>(
    () => initialTab ?? loadStoredLibraryTab() ?? 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<LibrarySortField>(
    () => loadStoredLibrarySortField() ?? 'recent'
  );
  const [sortDirection, setSortDirection] = useState<LibrarySortDirection>(
    () =>
      loadStoredLibrarySortDirection() ??
      getDefaultSortDirection(loadStoredLibrarySortField() ?? 'recent')
  );
  const [isCustomExpanded, setIsCustomExpanded] = useState<boolean>(
    () => loadStoredLibraryCustomExpanded() ?? true
  );
  const [isStudyExpanded, setIsStudyExpanded] = useState<boolean>(
    () => loadStoredLibraryStudyExpanded() ?? true
  );
  const [isBlueprintExpanded, setIsBlueprintExpanded] = useState<boolean>(
    () => loadStoredLibraryBlueprintExpanded() ?? false
  );

  const handleSelectTab = (tab: FilterTab) => {
    setActiveTab(tab);
    saveStoredLibraryTab(tab);
  };

  const handleSortFieldChange = (field: LibrarySortField) => {
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

  const handleToggleDirection = () => {
    setSortDirection((prev) => {
      const next: LibrarySortDirection = prev === 'desc' ? 'asc' : 'desc';
      saveStoredLibrarySortDirection(next);
      return next;
    });
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab ?? loadStoredLibraryTab() ?? 'all');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const counts = useMemo(() => {
    const custom = catalog.filter(
      (item) => item.category === 'custom' || item.isCustom
    ).length;
    const study = catalog.filter((item) => item.category === 'study').length;
    const blueprint = catalog.filter(
      (item) => item.category === 'blueprint'
    ).length;
    return { all: catalog.length, custom, study, blueprint };
  }, [catalog]);

  const sortedFilteredScores = useMemo(() => {
    const filtered = filterScoreCatalog(catalog, {
      tab: activeTab,
      query: searchQuery,
      source: 'all',
      aspect: 'all',
    });
    return sortScoreCatalog(filtered, sortField, sortDirection);
  }, [catalog, activeTab, searchQuery, sortField, sortDirection]);

  const isSearching = searchQuery.trim().length > 0;

  const sections = useMemo(() => {
    const customItems = sortedFilteredScores.filter(
      (item) => item.category === 'custom' || item.isCustom
    );
    const studyItems = sortedFilteredScores.filter(
      (item) => item.category === 'study'
    );
    const blueprintItems = sortedFilteredScores.filter(
      (item) => item.category === 'blueprint'
    );

    return [
      {
        key: 'custom' as const,
        label: 'Custom Projects',
        items: customItems,
        expanded: isSearching || isCustomExpanded,
        badgeClass:
          'bg-amber-500/15 border-amber-400/30 text-amber-600 dark:text-amber-300',
        onToggle: () =>
          setIsCustomExpanded((prev) => {
            const next = !prev;
            saveStoredLibraryCustomExpanded(next);
            return next;
          }),
      },
      {
        key: 'study' as const,
        label: 'Scene Studies',
        items: studyItems,
        expanded: isSearching || isStudyExpanded,
        badgeClass:
          'bg-violet-500/15 border-violet-400/30 text-violet-600 dark:text-violet-300',
        onToggle: () =>
          setIsStudyExpanded((prev) => {
            const next = !prev;
            saveStoredLibraryStudyExpanded(next);
            return next;
          }),
      },
      {
        key: 'blueprint' as const,
        label: 'Bundled Blueprints',
        items: blueprintItems,
        expanded: isSearching || isBlueprintExpanded,
        badgeClass:
          'bg-sky-500/15 border-sky-400/30 text-sky-600 dark:text-sky-300',
        onToggle: () =>
          setIsBlueprintExpanded((prev) => {
            const next = !prev;
            saveStoredLibraryBlueprintExpanded(next);
            return next;
          }),
      },
    ];
  }, [
    sortedFilteredScores,
    isSearching,
    isCustomExpanded,
    isStudyExpanded,
    isBlueprintExpanded,
  ]);

  const handleCardClick = (id: string) => {
    onSelectScene(id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-score-library-title"
      className="fixed inset-0 z-50 bg-app text-text-main flex flex-col overflow-hidden animate-in fade-in duration-150"
    >
      {/* 1. Mobile Header Bar */}
      <header className="h-14 px-4 bg-surface border-b border-border-main flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-surface-muted border border-border-main flex items-center justify-center text-text-main shrink-0 shadow-2xs">
            <Clapperboard className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2
              id="mobile-score-library-title"
              className="text-sm font-bold font-sans text-text-main tracking-tight leading-none truncate"
            >
              Choreography Library
            </h2>
            <span className="text-[11px] font-sans text-text-muted truncate block mt-0.5">
              Tap any scene to switch instantly
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close library"
          className={UI_TOKENS.button.iconClose}
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* 2. Category Chips + Compact Search & Sort */}
      <div className="px-3 py-2 bg-surface-subtle border-b border-border-subtle shrink-0 space-y-2 select-none">
        <div className="overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'custom', label: `Custom (${counts.custom})` },
              { id: 'study', label: `Studies (${counts.study})` },
              { id: 'blueprint', label: `Blueprints (${counts.blueprint})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectTab(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-mono font-medium shrink-0 transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-border-main'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-text-faint absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scores..."
              className="w-full pl-8 pr-7 py-1.5 bg-surface border border-border-main/70 text-xs text-text-body placeholder-text-placeholder rounded-xl outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-main"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            aria-label="Sort scores"
            value={sortField}
            onChange={(e) =>
              handleSortFieldChange(e.target.value as LibrarySortField)
            }
            className="px-2 py-1.5 rounded-xl bg-surface border border-border-main text-[11px] font-mono text-text-main outline-none"
          >
            <option value="recent">Recent</option>
            <option value="title">A–Z</option>
            <option value="duration">Duration</option>
            <option value="shots">Shots</option>
          </select>

          <button
            type="button"
            onClick={handleToggleDirection}
            aria-label="Toggle sort direction"
            className="p-1.5 rounded-xl bg-surface border border-border-main text-text-muted hover:text-text-main"
          >
            {sortDirection === 'desc' ? (
              <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpNarrowWide className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* 3. Fast-Scrolling 1-Tap Score List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {sortedFilteredScores.length === 0 ? (
          <div className="py-16 text-center text-text-muted font-sans text-xs">
            No choreography scores found.
          </div>
        ) : activeTab === 'all' ? (
          <div className="space-y-3">
            {sections.map(
              (section) =>
                section.items.length > 0 && (
                  <div key={section.key} className="space-y-1.5">
                    <button
                      type="button"
                      onClick={section.onToggle}
                      aria-expanded={section.expanded}
                      className="w-full px-2 py-1 text-[10px] font-mono font-bold tracking-wider text-text-muted hover:text-text-main uppercase flex items-center justify-between rounded-md hover:bg-surface-subtle transition-colors group select-none cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-text-faint group-hover:text-text-main transition-transform duration-150 ${
                            section.expanded ? 'rotate-0' : '-rotate-90'
                          }`}
                        />
                        <span>{section.label}</span>
                      </div>
                      <span
                        className={`text-[9.5px] px-1.5 py-0.2 rounded-full border font-mono ${section.badgeClass}`}
                      >
                        {section.items.length}
                      </span>
                    </button>

                    {section.expanded && (
                      <div className="space-y-1.5">
                        {section.items.map((item) => (
                          <ScoreLibraryCard
                            key={item.id}
                            item={item}
                            isActive={item.id === activeSceneId}
                            onSelect={() => handleCardClick(item.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedFilteredScores.map((item) => (
              <ScoreLibraryCard
                key={item.id}
                item={item}
                isActive={item.id === activeSceneId}
                onSelect={() => handleCardClick(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
