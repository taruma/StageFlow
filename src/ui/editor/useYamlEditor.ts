/**
 * Custom hook encapsulating the CodeMirror 6 lifecycle for the YAML Score Editor.
 * Features:
 * - Dynamic Compartments for zero-reload Theme & Read-Only swapping
 * - Debounced re-evaluation (~150ms) protecting 60fps WebGL diorama performance
 * - Unified document-level Undo/Redo (`historyRevision`) replacing CodeMirror's isolated stack
 * - Bidirectional sync guard preventing external-props echo loops
 * - Jump-to-line helper for instant syntax diagnostic navigation
 */

import { useEffect, useRef, useCallback } from 'react';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import {
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from '@codemirror/language';
import {
  searchKeymap,
  search,
  highlightSelectionMatches,
} from '@codemirror/search';
import { yaml } from '@codemirror/lang-yaml';
import { createStageflowCodeMirrorTheme } from './useCodeMirrorTheme';

export interface UseYamlEditorOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  rawYaml: string;
  sceneId?: string;
  historyRevision?: number;
  isBundled: boolean;
  effectiveTheme: 'dark' | 'warm' | 'light';
  wordWrap?: boolean;
  onChangeYaml: (newYaml: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  debounceMs?: number;
}

export interface UseYamlEditorResult {
  jumpToLine: (line: number, column?: number) => void;
  focus: () => void;
}

export function useYamlEditor({
  containerRef,
  rawYaml,
  sceneId,
  historyRevision = 0,
  isBundled,
  effectiveTheme,
  wordWrap = true,
  onChangeYaml,
  onUndo,
  onRedo,
  debounceMs = 150,
}: UseYamlEditorOptions): UseYamlEditorResult {
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyCompartmentRef = useRef(new Compartment());
  const themeCompartmentRef = useRef(new Compartment());
  const wrapCompartmentRef = useRef(new Compartment());
  const lastDispatchedTextRef = useRef<string>(rawYaml);
  const lastSceneIdRef = useRef<string | undefined>(sceneId);
  const lastHistoryRevisionRef = useRef<number>(historyRevision);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChangeYamlRef = useRef(onChangeYaml);
  onChangeYamlRef.current = onChangeYaml;
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;
  const onRedoRef = useRef(onRedo);
  onRedoRef.current = onRedo;

  const flushPendingDebounce = useCallback((view: EditorView) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      const pendingText = view.state.doc.toString();
      if (pendingText !== lastDispatchedTextRef.current) {
        lastDispatchedTextRef.current = pendingText;
        onChangeYamlRef.current(pendingText);
      }
    }
  }, []);

  // 1. Mount CodeMirror EditorView once on container attachment
  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const unifiedHistoryKeymap = Prec.highest(
      keymap.of([
        {
          key: 'Mod-z',
          run: (view) => {
            flushPendingDebounce(view);
            onUndoRef.current?.();
            return true;
          },
        },
        {
          key: 'Mod-Shift-z',
          run: (view) => {
            flushPendingDebounce(view);
            onRedoRef.current?.();
            return true;
          },
        },
        {
          key: 'Ctrl-y',
          run: (view) => {
            flushPendingDebounce(view);
            onRedoRef.current?.();
            return true;
          },
        },
      ])
    );

    const startState = EditorState.create({
      doc: rawYaml,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        yaml(),
        wrapCompartmentRef.current.of(
          wordWrap ? EditorView.lineWrapping : []
        ),
        search({ top: true }),
        unifiedHistoryKeymap,
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...searchKeymap,
          ...foldKeymap,
        ]),
        themeCompartmentRef.current.of(
          createStageflowCodeMirrorTheme(effectiveTheme)
        ),
        readOnlyCompartmentRef.current.of(
          EditorState.readOnly.of(isBundled)
        ),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const nextText = update.state.doc.toString();

            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
              debounceTimerRef.current = null;
              lastDispatchedTextRef.current = nextText;
              onChangeYamlRef.current(nextText);
            }, debounceMs);
          }
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent,
    });

    viewRef.current = view;
    lastDispatchedTextRef.current = rawYaml;
    lastHistoryRevisionRef.current = historyRevision;

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      view.destroy();
      viewRef.current = null;
    };
    // Initialize strictly on container mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  // 2. Reconcile external changes to rawYaml (Score Library switch, drop loader, unified Undo/Redo)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const isSceneSwitched =
      sceneId !== undefined && sceneId !== lastSceneIdRef.current;
    if (isSceneSwitched) {
      lastSceneIdRef.current = sceneId;
      lastHistoryRevisionRef.current = historyRevision;
      lastDispatchedTextRef.current = rawYaml;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const currentDoc = view.state.doc.toString();
      if (currentDoc !== rawYaml) {
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: rawYaml },
          selection: { anchor: 0 },
        });
        view.scrollDOM.scrollTop = 0;
      }
      return;
    }

    const revisionChanged = historyRevision !== lastHistoryRevisionRef.current;
    if (revisionChanged) {
      lastHistoryRevisionRef.current = historyRevision;
      lastDispatchedTextRef.current = rawYaml;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== rawYaml) {
        const currentSelection = view.state.selection.main;
        const safeAnchor = Math.min(currentSelection.anchor, rawYaml.length);
        const safeHead = Math.min(currentSelection.head, rawYaml.length);
        view.dispatch({
          changes: { from: 0, to: currentDoc.length, insert: rawYaml },
          selection: { anchor: safeAnchor, head: safeHead },
        });
      }
      return;
    }

    if (rawYaml === lastDispatchedTextRef.current) {
      return;
    }

    if (view.hasFocus) {
      return;
    }

    lastDispatchedTextRef.current = rawYaml;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== rawYaml) {
      const currentSelection = view.state.selection.main;
      const safeAnchor = Math.min(currentSelection.anchor, rawYaml.length);
      const safeHead = Math.min(currentSelection.head, rawYaml.length);

      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: rawYaml },
        selection: { anchor: safeAnchor, head: safeHead },
      });
    }
  }, [rawYaml, sceneId, historyRevision]);

  // 3. Dynamic Read-Only Reconfiguration
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: readOnlyCompartmentRef.current.reconfigure(
        EditorState.readOnly.of(isBundled)
      ),
    });
  }, [isBundled]);

  // 4. Dynamic Theme Reconfiguration
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(
        createStageflowCodeMirrorTheme(effectiveTheme)
      ),
    });
  }, [effectiveTheme]);

  // 5. Dynamic Word Wrap Reconfiguration
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: wrapCompartmentRef.current.reconfigure(
        wordWrap ? EditorView.lineWrapping : []
      ),
    });
  }, [wordWrap]);

  // 6. Jump to designated line & column
  const jumpToLine = useCallback((line: number, column = 1) => {
    const view = viewRef.current;
    if (!view) return;

    const totalLines = view.state.doc.lines;
    const targetLineNum = Math.max(1, Math.min(line, totalLines));
    const lineInfo = view.state.doc.line(targetLineNum);

    const targetPos = Math.min(
      lineInfo.from + Math.max(0, column - 1),
      lineInfo.to
    );

    view.dispatch({
      selection: { anchor: targetPos },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  return { jumpToLine, focus };
}
