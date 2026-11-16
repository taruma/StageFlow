/**
 * Floating "How to Read the Storyboard" Spec Guide Popover.
 * Anchored to the `?` trigger beside Close in StoryboardModal's footer bar;
 * explains frame slate overlays, coordinate axes, camera angles, DoF focus slices,
 * and start-to-end arrows without cluttering the Contact Sheet itself.
 */

import React, { useEffect, useRef } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface StoryboardSpecGuidePopoverProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const GUIDE_ITEMS: ReadonlyArray<{ term: string; detail: string }> = [
  {
    term: 'SLATE',
    detail:
      'Top corners show #Shot (with START/MID/END beat dots) and shot timecode or @ sample second.',
  },
  {
    term: 'TARGET',
    detail:
      'Look-at subject plus off-center framing offset Δ[X, Y, Z] in meters (+X right, +Y up, +Z front).',
  },
  {
    term: 'RIG',
    detail:
      'Physical camera mount (tripod, track, or spline) when authored in the score.',
  },
  {
    term: 'CAM',
    detail:
      'Distance to target (m), Yaw (Y°, 0° = front/+Z), Pitch (P°, + above / − below), and Roll (R° horizon tilt).',
  },
  {
    term: 'MOVE',
    detail:
      'Camera trajectory maneuver (cut, dolly, orbit, dive, …) and easing curve.',
  },
  {
    term: 'OPTICS',
    detail:
      'Full-frame 36mm-equivalent focal length (mm) and aperture f-stop (f/2.8).',
  },
  {
    term: 'FOCUS',
    detail:
      'Focus plane depth (m) and sharp Depth-of-Field slice (Near–Far; ∞ = hyperfocal deep background).',
  },
  {
    term: 'OBS',
    detail:
      'Observer Diorama camera target, pose, and move shown in Observer mode while keeping Stage Shot specs intact.',
  },
  {
    term: 'A→B',
    detail:
      'Indicates a parameter animates from Start to End in grouped moving-shot cards.',
  },
];

export const StoryboardSpecGuidePopover: React.FC<
  StoryboardSpecGuidePopoverProps
> = ({ isOpen, onToggle, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);

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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="How to read storyboard specs"
        title="How to read storyboard technical specs"
        className={`h-9 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
          isOpen
            ? 'bg-surface text-text-main border-border-main shadow-xs'
            : 'bg-surface-muted/70 hover:bg-surface text-text-muted hover:text-text-main border-border-main'
        }`}
      >
        <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>Spec Guide</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Storyboard specification guide"
          className="absolute bottom-full right-0 mb-2.5 w-[340px] sm:w-[400px] max-w-[calc(100vw-2rem)] bg-surface border border-border-main rounded-2xl shadow-2xl overflow-hidden z-50 text-text-main animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3.5 py-2.5 bg-surface-subtle border-b border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold tracking-tight">
                How to Read Card Specs
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close spec guide"
              className="p-1 rounded-full hover:bg-surface-muted text-text-faint hover:text-text-main transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 space-y-2 max-h-[60vh] overflow-y-auto">
            {GUIDE_ITEMS.map((item) => (
              <div
                key={item.term}
                className="flex items-baseline gap-2.5 text-[11px] leading-snug"
              >
                <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0 w-[52px]">
                  {item.term}
                </span>
                <span className="text-text-body font-sans">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
