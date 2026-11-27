import { describe, it, expect } from 'vitest';
import {
  breakScoreHistoryCoalescing,
  canRedoScore,
  canUndoScore,
  commitScoreHistory,
  createScoreHistory,
  redoScoreHistory,
  undoScoreHistory,
} from '../../src/core/scoreHistory';

describe('scoreHistory', () => {
  it('initializes with empty past/future and revision 0', () => {
    const h = createScoreHistory('title: "A"');
    expect(h.present).toBe('title: "A"');
    expect(canUndoScore(h)).toBe(false);
    expect(canRedoScore(h)).toBe(false);
    expect(h.revision).toBe(0);
  });

  it('ignores no-op commits returning exact state reference', () => {
    const h = createScoreHistory('title: "A"');
    const h2 = commitScoreHistory(h, 'title: "A"', { mode: 'checkpoint' });
    expect(h2).toBe(h);
  });

  it('coalesces rapid small edits within same groupKey and window', () => {
    let h = createScoreHistory('title: "A"');
    h = commitScoreHistory(h, 'title: "AB"', {
      mode: 'coalesce',
      groupKey: 'yaml-source',
      timestamp: 1000,
    });
    expect(h.past).toEqual(['title: "A"']);

    h = commitScoreHistory(h, 'title: "ABC"', {
      mode: 'coalesce',
      groupKey: 'yaml-source',
      timestamp: 1200,
    });
    expect(h.past).toEqual(['title: "A"']);
    expect(h.present).toBe('title: "ABC"');

    // Beyond coalesce window creates a new checkpoint
    h = commitScoreHistory(h, 'title: "ABCD"', {
      mode: 'coalesce',
      groupKey: 'yaml-source',
      timestamp: 2500,
    });
    expect(h.past).toEqual(['title: "A"', 'title: "ABC"']);
  });

  it('auto-checkpoints bulk single-step edits (> 32 chars)', () => {
    let h = createScoreHistory('title: "A"');
    h = commitScoreHistory(h, 'title: "AB"', {
      mode: 'coalesce',
      groupKey: 'yaml-source',
      timestamp: 1000,
    });
    const largePaste = 'title: "' + 'X'.repeat(40) + '"';
    h = commitScoreHistory(h, largePaste, {
      mode: 'coalesce',
      groupKey: 'yaml-source',
      timestamp: 1100,
    });
    expect(h.past).toEqual(['title: "A"', 'title: "AB"']);
  });

  it('pops redundant entry when coalesced backspacing returns to pre-burst snapshot', () => {
    let h = createScoreHistory('title: "A"');
    h = commitScoreHistory(h, 'title: "AB"', {
      mode: 'coalesce',
      groupKey: 'yaml-source',
      timestamp: 1000,
    });
    h = commitScoreHistory(h, 'title: "A"', {
      mode: 'coalesce',
      groupKey: 'yaml-source',
      timestamp: 1100,
    });
    expect(h.past).toEqual([]);
    expect(canUndoScore(h)).toBe(false);
  });

  it('increments monotonic revision on undo and redo', () => {
    let h = createScoreHistory('v1');
    h = commitScoreHistory(h, 'v2', { mode: 'checkpoint' });
    h = commitScoreHistory(h, 'v3', { mode: 'checkpoint' });

    h = undoScoreHistory(h);
    expect(h.present).toBe('v2');
    expect(h.revision).toBe(1);
    expect(canRedoScore(h)).toBe(true);

    h = undoScoreHistory(h);
    expect(h.present).toBe('v1');
    expect(h.revision).toBe(2);
    expect(canUndoScore(h)).toBe(false);

    h = redoScoreHistory(h);
    expect(h.present).toBe('v2');
    expect(h.revision).toBe(3);

    // Committing after undo clears redo future
    h = commitScoreHistory(h, 'v2-branch', { mode: 'checkpoint' });
    expect(canRedoScore(h)).toBe(false);
  });

  it('breaks coalescing cleanly and caps maxEntries', () => {
    let h = createScoreHistory('0');
    for (let i = 1; i <= 5; i++) {
      h = commitScoreHistory(h, String(i), {
        mode: 'checkpoint',
        maxEntries: 3,
      });
    }
    expect(h.past).toEqual(['2', '3', '4']);
    expect(h.present).toBe('5');

    const broken = breakScoreHistoryCoalescing(h);
    expect(broken.lastCommitMode).toBeNull();
  });
});
