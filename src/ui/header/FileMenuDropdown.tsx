/**
 * FileMenuDropdown Component for StageFlow Studio Header.
 * Houses workflow-grouped project/score actions, 3D skin I/O, exports,
 * and reference links in a tiered SceneFlow-style dropdown.
 */

import React, { useRef, useEffect } from 'react';
import {
  Box,
  ChevronDown,
  FolderOpen,
  Download,
  Film,
  LayoutGrid,
  Plus,
  FolderKanban,
  Book,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { UI_TOKENS } from '../tokens/ui';
import type { FilterTab } from '../ScoreLibraryModal';

export interface FileMenuDropdownProps {
  isOpen: boolean;
  customScoresCount: number;
  activeSkinsCount?: number;
  onToggle: () => void;
  onClose: () => void;
  onUploadFiles: (files: FileList) => void;
  onClearAllSkins?: () => void;
  onExportActiveScore: () => void;
  onOpenVideoExport?: () => void;
  onOpenStoryboard?: () => void;
  onCreateBlankScore?: () => void;
  onOpenLibrary: (tab?: FilterTab) => void;
}

const SectionHeading: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-2.5 pt-1 pb-0.5 text-[9px] font-black uppercase tracking-widest text-text-faint">
    {title}
  </div>
);

interface MenuRowProps {
  icon: React.ReactNode;
  label: string;
  tag?: string;
  badge?: React.ReactNode;
  title?: string;
  disabled?: boolean;
  tone?: 'default' | 'danger' | 'amber';
  onClick: () => void;
}

const MenuRow: React.FC<MenuRowProps> = ({
  icon,
  label,
  tag,
  badge,
  title,
  disabled = false,
  tone = 'default',
  onClick,
}) => {
  const toneClass = disabled
    ? 'text-text-muted opacity-45 cursor-not-allowed'
    : tone === 'danger'
    ? 'text-rose-500 hover:bg-rose-500/10 cursor-pointer'
    : tone === 'amber'
    ? 'text-text-body hover:text-amber-600 dark:hover:text-amber-300 hover:bg-surface-subtle cursor-pointer'
    : 'text-text-body hover:text-text-main hover:bg-surface-subtle cursor-pointer';

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-left ${toneClass}`}
    >
      <span className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="whitespace-nowrap truncate">{label}</span>
      </span>
      {badge}
      {tag && (
        <span className="text-[9px] font-mono uppercase tracking-wider text-text-faint shrink-0">
          {tag}
        </span>
      )}
    </button>
  );
};

export const FileMenuDropdown: React.FC<FileMenuDropdownProps> = ({
  isOpen,
  customScoresCount,
  activeSkinsCount = 0,
  onToggle,
  onClose,
  onUploadFiles,
  onClearAllSkins,
  onExportActiveScore,
  onOpenVideoExport,
  onOpenStoryboard,
  onCreateBlankScore,
  onOpenLibrary,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
      onClose();
    }
  };

  return (
    <div ref={containerRef} className="relative select-none">
      {/* File Menu Trigger Button */}
      <button
        type="button"
        id="studio-file-menu-button"
        onClick={onToggle}
        className={`${
          isOpen ? UI_TOKENS.button.filePillActive : UI_TOKENS.button.filePill
        } flex items-center gap-1.5`}
        title="Score & File Actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span>File</span>
        <ChevronDown
          className={`w-3 h-3 text-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-text-main' : ''
          }`}
        />
      </button>

      {/* Hidden File Input for Scores & Videos */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json,.mp4,.webm,.mov,video/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden File Input for 3D .GLB / .GLTF Skins */}
      <input
        ref={skinInputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          role="menu"
          aria-labelledby="studio-file-menu-button"
          className="absolute top-full left-0 mt-2 w-72 bg-surface rounded-xl shadow-xl border border-border-main overflow-hidden z-50 text-text-main text-xs font-mono divide-y divide-border-subtle animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Section 1: Score & Project */}
          <div className="p-1.5 space-y-0.5">
            <SectionHeading title="Score & Project" />
            {onCreateBlankScore && (
              <MenuRow
                icon={<Plus className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                label="New Blank Score..."
                title="Create a new blank choreography score"
                onClick={() => {
                  onCreateBlankScore();
                  onClose();
                }}
              />
            )}
            <MenuRow
              icon={<FolderOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
              label="Open Score or Video..."
              tag="YAML · MP4"
              title="Load local .yaml choreography score or .mp4/.webm reference video"
              onClick={() => fileInputRef.current?.click()}
            />
            <MenuRow
              icon={<Book className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              label="Score Library..."
              tone="amber"
              title="Browse bundled blueprint scores and custom scores"
              onClick={() => {
                onOpenLibrary();
                onClose();
              }}
            />
            <MenuRow
              icon={<FolderKanban className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
              label="Manage Custom Scores"
              title="Manage Custom Scores (Rename, Duplicate, Export, Delete)"
              badge={
                customScoresCount > 0 ? (
                  <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                    {customScoresCount}
                  </span>
                ) : undefined
              }
              onClick={() => {
                onOpenLibrary('custom');
                onClose();
              }}
            />
          </div>

          {/* Section 2: 3D Skins */}
          <div className="p-1.5 space-y-0.5">
            <SectionHeading title="3D Skins" />
            <MenuRow
              icon={<Box className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              label="Load 3D Skins..."
              tag=".GLB"
              title="Load one or multiple local .glb/.gltf 3D stage or entity skins"
              onClick={() => skinInputRef.current?.click()}
            />
            {onClearAllSkins && (
              <MenuRow
                icon={<Trash2 className="w-3.5 h-3.5 shrink-0" />}
                label="Clear All 3D Skins"
                disabled={activeSkinsCount === 0}
                tone="danger"
                title={
                  activeSkinsCount > 0
                    ? 'Remove all loaded 3D .glb/.gltf skins from the current session'
                    : 'No 3D skins currently loaded'
                }
                badge={
                  activeSkinsCount > 0 ? (
                    <span className="text-[10px] bg-rose-500/15 text-rose-500 px-1.5 py-0.2 rounded-full font-bold shrink-0">
                      {activeSkinsCount}
                    </span>
                  ) : undefined
                }
                onClick={() => {
                  onClearAllSkins();
                  onClose();
                }}
              />
            )}
          </div>

          {/* Section 3: Export & Storyboard */}
          <div className="p-1.5 space-y-0.5">
            <SectionHeading title="Export & Storyboard" />
            <MenuRow
              icon={<Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              label="Export Active Score"
              tag=".YAML"
              title="Download active choreography score as .yaml file"
              onClick={() => {
                onExportActiveScore();
                onClose();
              }}
            />
            {onOpenVideoExport && (
              <MenuRow
                icon={<Film className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                label="Export Video..."
                tag=".MP4"
                title="Render and download clean Stage Cam MP4 video in browser"
                onClick={() => {
                  onOpenVideoExport();
                  onClose();
                }}
              />
            )}
            {onOpenStoryboard && (
              <MenuRow
                icon={<LayoutGrid className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                label="Storyboard..."
                title="Generate and inspect a shot-by-shot Storyboard contact sheet"
                onClick={() => {
                  onOpenStoryboard();
                  onClose();
                }}
              />
            )}
          </div>

          {/* Section 4: Documentation */}
          <div className="p-1.5 space-y-0.5">
            <SectionHeading title="Documentation" />
            <a
              href="?mode=guide"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition-colors text-left"
              title="Open StageFlow YAML Score Authoring Manual in a new tab"
            >
              <span>YAML Authoring Guide</span>
              <ExternalLink className="w-3 h-3 text-text-faint" />
            </a>
            <a
              href="?mode=spec"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-subtle transition-colors text-left"
              title="Open StageFlow Script Technical Specification in a new tab"
            >
              <span>Script Specification</span>
              <ExternalLink className="w-3 h-3 text-text-faint" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
