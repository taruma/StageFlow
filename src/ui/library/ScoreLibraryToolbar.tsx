/**
 * ScoreLibraryToolbar Component for ScoreLibraryModal.
 * Compact 2-row navigation bar providing:
 * - Row 1: Category tabs (All, Custom, Studies, Blueprints), Search input ('/'), Details toggle ('I')
 * - Row 2: Media Source filter, Aspect Ratio filter, Sort pills + Direction toggle, and Reset action
 */

import React from 'react';
import {
  Search,
  X,
  PanelRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  RotateCcw,
} from 'lucide-react';
import type {
  LibraryAspectFilter,
  LibraryFilterTab,
  LibrarySortDirection,
  LibrarySortField,
  LibrarySourceFilter,
} from '../../core/types';
import { UI_TOKENS } from '../tokens/ui';

export interface ScoreLibraryToolbarProps {
  activeTab: LibraryFilterTab;
  onSelectTab: (tab: LibraryFilterTab) => void;
  counts: {
    all: number;
    custom: number;
    study: number;
    blueprint: number;
  };
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  sourceFilter: LibrarySourceFilter;
  onSourceFilterChange: (source: LibrarySourceFilter) => void;
  aspectFilter: LibraryAspectFilter;
  onAspectFilterChange: (aspect: LibraryAspectFilter) => void;
  hasOtherAspect: boolean;
  sortField: LibrarySortField;
  sortDirection: LibrarySortDirection;
  onSelectSortField: (field: LibrarySortField) => void;
  onToggleSortDirection: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

const SORT_OPTIONS: { field: LibrarySortField; label: string }[] = [
  { field: 'recent', label: 'Recent' },
  { field: 'title', label: 'A–Z' },
  { field: 'duration', label: 'Duration' },
  { field: 'shots', label: 'Shots' },
];

export const ScoreLibraryToolbar: React.FC<ScoreLibraryToolbarProps> = ({
  activeTab,
  onSelectTab,
  counts,
  searchQuery,
  onSearchChange,
  searchInputRef,
  sourceFilter,
  onSourceFilterChange,
  aspectFilter,
  onAspectFilterChange,
  hasOtherAspect,
  sortField,
  sortDirection,
  onSelectSortField,
  onToggleSortDirection,
  showDetails,
  onToggleDetails,
  hasActiveFilters,
  onResetFilters,
}) => {
  const pillBase =
    'px-2 py-0.5 rounded-lg text-[10.5px] font-mono transition-colors cursor-pointer select-none whitespace-nowrap';
  const pillInactive =
    'text-text-muted hover:text-text-main hover:bg-surface border border-transparent';
  const pillActive =
    'bg-surface text-text-main font-bold border border-border-main shadow-2xs';

  return (
    <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-subtle space-y-2 shrink-0">
      {/* Row 1: Category Tabs + Search + Details Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={UI_TOKENS.button.segmentedGroup}>
          <button
            type="button"
            onClick={() => onSelectTab('all')}
            className={
              activeTab === 'all'
                ? UI_TOKENS.button.segmentedItemActive
                : UI_TOKENS.button.segmentedItem
            }
          >
            All ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('custom')}
            className={
              activeTab === 'custom'
                ? UI_TOKENS.button.segmentedItemActive
                : UI_TOKENS.button.segmentedItem
            }
          >
            Custom ({counts.custom})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('study')}
            className={
              activeTab === 'study'
                ? UI_TOKENS.button.segmentedItemActive
                : UI_TOKENS.button.segmentedItem
            }
          >
            Studies ({counts.study})
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('blueprint')}
            className={
              activeTab === 'blueprint'
                ? UI_TOKENS.button.segmentedItemActive
                : UI_TOKENS.button.segmentedItem
            }
          >
            Blueprints ({counts.blueprint})
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md justify-end">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-text-faint absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search title, premise, or ID..."
              className="w-full pl-8 pr-7 py-1.5 bg-surface border border-border-main/70 focus:border-border-main text-xs text-text-body placeholder-text-placeholder rounded-xl transition-colors outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-main cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] font-mono text-text-faint px-1 rounded bg-surface-subtle border border-border-subtle pointer-events-none">
                /
              </kbd>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleDetails}
            aria-pressed={showDetails}
            title="Toggle Inspector Details (I)"
            className={
              showDetails
                ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-btn-primary-bg text-btn-primary-text border border-btn-primary-bg text-xs font-mono font-bold shadow-xs cursor-pointer transition-all shrink-0'
                : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface hover:bg-surface-hover text-text-body hover:text-text-main border border-border-main text-xs font-mono font-semibold shadow-2xs cursor-pointer transition-all shrink-0'
            }
          >
            <PanelRight className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>
      </div>

      {/* Row 2: Source Filter + Aspect Filter + Sort & Direction */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Media Source */}
          <div className="flex items-center gap-1">
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-text-faint mr-0.5">
              Source
            </span>
            <div className="flex items-center gap-0.5 bg-surface-muted/70 p-0.5 rounded-lg border border-border-subtle">
              <button
                type="button"
                onClick={() => onSourceFilterChange('all')}
                className={`${pillBase} ${sourceFilter === 'all' ? pillActive : pillInactive}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onSourceFilterChange('youtube')}
                className={`${pillBase} ${sourceFilter === 'youtube' ? pillActive : pillInactive}`}
              >
                YouTube
              </button>
              <button
                type="button"
                onClick={() => onSourceFilterChange('other')}
                className={`${pillBase} ${sourceFilter === 'other' ? pillActive : pillInactive}`}
              >
                Sim / Local
              </button>
            </div>
          </div>

          {/* Film Gate Aspect */}
          <div className="flex items-center gap-1">
            <span className="text-[9.5px] font-mono uppercase tracking-wider text-text-faint mr-0.5">
              Aspect
            </span>
            <div className="flex items-center gap-0.5 bg-surface-muted/70 p-0.5 rounded-lg border border-border-subtle">
              <button
                type="button"
                onClick={() => onAspectFilterChange('all')}
                className={`${pillBase} ${aspectFilter === 'all' ? pillActive : pillInactive}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onAspectFilterChange('16:9')}
                className={`${pillBase} ${aspectFilter === '16:9' ? pillActive : pillInactive}`}
              >
                16:9
              </button>
              <button
                type="button"
                onClick={() => onAspectFilterChange('scope')}
                className={`${pillBase} ${aspectFilter === 'scope' ? pillActive : pillInactive}`}
              >
                Scope
              </button>
              {(hasOtherAspect || aspectFilter === 'other') && (
                <button
                  type="button"
                  onClick={() => onAspectFilterChange('other')}
                  className={`${pillBase} ${aspectFilter === 'other' ? pillActive : pillInactive}`}
                >
                  Other
                </button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-mono text-text-muted hover:text-text-main hover:bg-surface border border-transparent hover:border-border-subtle transition-colors cursor-pointer"
              title="Clear search and filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Sort Controls + Direction Toggle */}
        <div className="flex items-center gap-1">
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-text-faint mr-0.5">
            Sort
          </span>
          <div className="flex items-center gap-0.5 bg-surface-muted/70 p-0.5 rounded-lg border border-border-subtle">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.field}
                type="button"
                onClick={() => onSelectSortField(opt.field)}
                className={`${pillBase} ${sortField === opt.field ? pillActive : pillInactive}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleSortDirection}
            aria-label={
              sortDirection === 'desc'
                ? 'Sort descending (click for ascending)'
                : 'Sort ascending (click for descending)'
            }
            title={
              sortDirection === 'desc'
                ? 'Descending (click to flip)'
                : 'Ascending (click to flip)'
            }
            className="p-1 rounded-lg bg-surface hover:bg-surface-hover border border-border-main text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            {sortDirection === 'desc' ? (
              <ArrowDownWideNarrow className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpNarrowWide className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
