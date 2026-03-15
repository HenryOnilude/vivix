<script>
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { javascript } from '@codemirror/lang-javascript';
  import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language';
  import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
  import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
  import { highlightSelectionMatches } from '@codemirror/search';

  let { value = $bindable(''), accent = '#38bdf8', readonly = false, onchange = null } = $props();

  let container;
  let view;
  let updating = false;

  function buildTheme(col) {
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

  const syntaxColors = syntaxHighlighting(defaultHighlightStyle.define([
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

  function createState(doc, col) {
    return EditorState.create({
      doc,
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
        buildTheme(col),
        syntaxColors,
        EditorState.tabSize.of(2),
        EditorView.editable.of(!readonly),
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
  }

  onMount(() => {
    view = new EditorView({
      state: createState(value, accent),
      parent: container,
    });
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

<div class="cm-wrapper" bind:this={container}></div>

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
  }
  .cm-wrapper :global(.cm-editor) {
    flex: 1;
    min-height: 0;
  }
</style>
