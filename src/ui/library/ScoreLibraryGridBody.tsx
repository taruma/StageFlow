/**
 * ScoreLibraryGridBody Component for ScoreLibraryModal.
 * Renders either the grouped collapsible sections (All tab) or a flat responsive card grid.
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { ScoreCatalogItem } from '../../core/scoreCatalog';
import type { LibraryFilterTab } from '../../core/types';
import { ScoreLibraryCard } from './ScoreLibraryCard';

export interface ScoreLibrarySectionGroup {
  key: 'custom' | 'study' | 'blueprint';
  label: string;
  items: ScoreCatalogItem[];
  expanded: boolean;
  badgeClass: string;
  onToggle: () => void;
}

export interface ScoreLibraryGridBodyProps {
  activeTab: LibraryFilterTab;
  showDetails: boolean;
  sections: ScoreLibrarySectionGroup[];
  sortedFilteredScores: ScoreCatalogItem[];
  activeSceneId: string;
  selectedScoreId: string | null;
  filtersActive: boolean;
  listContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectScore: (id: string) => void;
  onLoadScore: (id: string) => void;
  onInspectScore: (id: string) => void;
  onResetFilters: () => void;
}

export const ScoreLibraryGridBody: React.FC<ScoreLibraryGridBodyProps> = ({
  activeTab,
  showDetails,
  sections,
  sortedFilteredScores,
  activeSceneId,
  selectedScoreId,
  filtersActive,
  listContainerRef,
  onSelectScore,
  onLoadScore,
  onInspectScore,
  onResetFilters,
}) => {
  const gridClassName = showDetails
    ? 'grid grid-cols-1 xl:grid-cols-2 gap-2'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2';

  const renderCards = (items: ScoreCatalogItem[]) => (
    <div className={gridClassName}>
      {items.map((item) => (
        <ScoreLibraryCard
          key={item.id}
          item={item}
          isActive={item.id === activeSceneId}
          isSelected={item.id === selectedScoreId}
          onSelect={() => onSelectScore(item.id)}
          onDoubleClick={() => onLoadScore(item.id)}
          onInspect={() => onInspectScore(item.id)}
        />
      ))}
    </div>
  );

  return (
    <div
      ref={listContainerRef}
      className={`${
        showDetails
          ? 'w-full md:w-[52%] lg:w-[55%] border-b md:border-b-0 md:border-r border-border-subtle'
          : 'w-full'
      } flex-1 overflow-y-auto p-3.5 custom-scrollbar bg-surface`}
    >
      {sortedFilteredScores.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <p className="text-text-muted font-sans text-xs">
            No choreography scores match your current filters.
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={onResetFilters}
              className="px-3 py-1 rounded-lg bg-surface-subtle border border-border-main text-xs font-mono text-text-main hover:bg-surface-hover cursor-pointer"
            >
              Reset filters
            </button>
          )}
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

                  {section.expanded && renderCards(section.items)}
                </div>
              )
          )}
        </div>
      ) : (
        renderCards(sortedFilteredScores)
      )}
    </div>
  );
};
