<script>
  import { onMount, onDestroy } from 'svelte';

  let { value = $bindable(''), accent = '#38bdf8', readonly = false, placeholder = '', onchange = null } = $props();

  let container;
  let view;
  let updating = false;
  let loaded = $state(false);

  function buildTheme(col, EditorView) {
    return EditorView.theme({
      '&': {
        backgroundColor: '#08080e',
        color: '#e0e0e0',
        fontSize: '0.82rem',
        fontFamily: "'SF Mono','Fira Code','Cascadia Code',monospace",
        height: '100%',
        borderRadius: '0 0 6px 6px',
      },
      '.cm-content': {
        padding: '10px 4px',
        caretColor: col,
        lineHeight: '1.8',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: col,
        borderLeftWidth: '2px',
      },
      '.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: `${col}22`,
      },
      '.cm-activeLine': {
        backgroundColor: `${col}08`,
      },
      '.cm-activeLineGutter': {
        backgroundColor: '#0a0a14',
        color: col,
      },
      '.cm-gutters': {
        backgroundColor: '#08080e',
        color: '#2a2a3e',
        border: 'none',
        borderRight: '1px solid #1a1a2e',
        minWidth: '32px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 4px 0 8px',
        fontSize: '0.65rem',
        minWidth: '20px',
      },
      '.cm-scroller': {
        overflow: 'auto',
      },
      '.cm-matchingBracket': {
        backgroundColor: `${col}30`,
        outline: `1px solid ${col}44`,
      },
      '.cm-selectionMatch': {
        backgroundColor: `${col}15`,
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-tooltip': {
        backgroundColor: '#0d0d18',
        border: '1px solid #1a1a2e',
        color: '#e0e0e0',
      },
    }, { dark: true });
  }

  onMount(async () => {
    // ── Lazy-load CodeMirror — keeps it out of the initial JS bundle ──────────
    const [
      { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, placeholder: cmPlaceholder },
      { EditorState },
      { javascript },
      { syntaxHighlighting, HighlightStyle, bracketMatching, indentOnInput },
      { defaultKeymap, indentWithTab, history, historyKeymap },
      { closeBrackets, closeBracketsKeymap },
      { highlightSelectionMatches },
    ] = await Promise.all([
      import('@codemirror/view'),
      import('@codemirror/state'),
      import('@codemirror/lang-javascript'),
      import('@codemirror/language'),
      import('@codemirror/commands'),
      import('@codemirror/autocomplete'),
      import('@codemirror/search'),
    ]);

    const syntaxColors = syntaxHighlighting(HighlightStyle.define([
      { tag: ['keyword'], color: '#c084fc' },
      { tag: ['string', 'special(string)'], color: '#4ade80' },
      { tag: ['number', 'integer', 'float'], color: '#fb923c' },
      { tag: ['bool'], color: '#f59e0b' },
      { tag: ['variableName'], color: '#e0e0e0' },
      { tag: ['function(variableName)'], color: '#38bdf8' },
      { tag: ['definition(variableName)'], color: '#e0e0e0' },
      { tag: ['propertyName'], color: '#60a5fa' },
      { tag: ['operator'], color: '#888' },
      { tag: ['comment'], color: '#3a3a5e', fontStyle: 'italic' },
      { tag: ['punctuation'], color: '#555' },
      { tag: ['className'], color: '#fbbf24' },
      { tag: ['typeName'], color: '#f472b6' },
      { tag: ['null'], color: '#666' },
      { tag: ['regexp'], color: '#f87171' },
    ]));

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightSelectionMatches(),
        history(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        javascript(),
        buildTheme(accent, EditorView),
        syntaxColors,
        EditorState.tabSize.of(2),
        EditorView.editable.of(!readonly),
        ...(placeholder ? [cmPlaceholder(placeholder)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !updating) {
            updating = true;
            value = update.state.doc.toString();
            if (onchange) onchange(value);
            updating = false;
          }
        }),
      ],
    });

    view = new EditorView({ state, parent: container });
    loaded = true;
  });

  onDestroy(() => {
    if (view) view.destroy();
  });

  // Sync external value changes into the editor
  $effect(() => {
    if (view && !updating) {
      const current = view.state.doc.toString();
      if (value !== current) {
        updating = true;
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
        });
        updating = false;
      }
    }
  });
</script>

<div class="cm-wrapper" bind:this={container}>
  {#if !loaded}
    <div class="cm-loading">Loading editor…</div>
  {/if}
</div>

<style>
  .cm-wrapper {
    flex: 1;
    min-height: 0;
    border: 1px solid #1a1a2e;
    border-top: none;
    border-radius: 0 0 6px 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #08080e;
  }
  .cm-wrapper :global(.cm-editor) {
    flex: 1;
    min-height: 0;
  }
  .cm-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    color: #333;
    font-family: var(--font-code);
  }
</style>
