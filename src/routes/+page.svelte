<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type Document as DbDocument } from '$lib/db';
  import { MovingWindowEditor } from '$lib/movingWindowEditor';
  import { StepBack, StepForward, Search, X } from '@lucide/svelte';

  let editorText = $state(''); // This will hold the full text for the preview
  let inputText = $state(''); // This will hold the value of the input field
  let windowRange = $state<[number, number]>([0, 0]); // Track current window bounds reactively
  let inputElement: HTMLInputElement;
  let currentDocument = $state<DbDocument | null>(null);
  let editor = $state<MovingWindowEditor | null>(null);
  let mode = $state<'INPUT' | 'SEARCH' | null>(null); // Tracks whether the omnibox is in INPUT or SEARCH mode
  let title = $state('');
  let searchMatches = $state<{ text: string; start: number; end: number }[]>([]);
  let searchQuery = $state('');

  // Keep the input focused to prevent keyboard flicker and layout shifts on mobile
  function keepFocus(element: HTMLInputElement | null) {
    if (element && document.activeElement !== element) {
      element.focus();
    }
  }

  onMount(async () => {
    // Load or create the 'Scratch' document
    let doc = await db.documents.where('name').equals('Scratch').first();
    if (!doc) {
      const id = await db.documents.add({ name: 'Scratch', content: '' });
      doc = { id, name: 'Scratch', content: '' };
    }
    currentDocument = doc;

    // Initialize the MovingWindowEditor with the document's full content
    editor = new MovingWindowEditor(doc.content, doc.content.length, 50, 100);

    // Set the initial displayed text to the editor's full text for the preview
    editorText = editor.getText();
    // Also set the input field's initial value to the current window
    inputText = editor.getWindow();

    updatePreview();
    keepFocus(inputElement);
  });

  // Sync the full editor text to the database whenever it changes
  $effect(() => {
    if (editorText && currentDocument && editor) {
      db.documents.update(currentDocument.id, { content: editor.getText() });
      title = currentDocument.name + ' – Omniedit';
    }

    if (!mode && inputText !== '') {
      mode = 'INPUT';
    }
  });

  function stepBack() {
    if (editor) {
      editor.moveCursorByWindowSize(-1);
      updatePreview();
    }
  }

  function stepForward() {
    if (editor) {
      editor.moveCursorByWindowSize(1);
      updatePreview();
    }
  }

  function updatePreview() {
    if (editor) {
      editorText = editor.getText();
      inputText = editor.getWindow();
      windowRange = editor.getWindowStartEnd();
    }
  }

  function handleSearch() {
    if (!editor || !searchQuery) {
      searchMatches = [];
      return;
    }

    const results: { text: string; start: number; end: number }[] = [];
    try {
      const regex = new RegExp(searchQuery, 'gi'); // Global and case-insensitive search
      let match: RegExpExecArray | null;

      while ((match = regex.exec(editor.getText())) !== null) {
        results.push({
          text: match[0],
          start: match.index,
          end: regex.lastIndex,
        });
        if (regex.lastIndex === match.index) {
          regex.lastIndex++; // Avoid infinite loop on zero-width matches
        }
      }
    } catch {
      // Invalid regex, ignore search
    }
    searchMatches = results;
  }

  function selectMatch(start: number) {
    if (editor) {
      editor.setCursor(start);
      editor.moveCursorByWindowSize(1); // Move window to start with the match
      updatePreview();
      searchQuery = '';
      searchMatches = [];
      mode = 'INPUT'; // Switch back to input mode
      keepFocus(inputElement); // Focus the main input
    }
  }

  function enterSearchMode() {
    searchQuery = ''; // Clear search query
    inputText = ''; // Clear input for search term
    searchMatches = [];
    mode = 'SEARCH';
    keepFocus(inputElement);
  }

  function cancelSearch() {
    searchQuery = '';
    searchMatches = [];
    mode = 'INPUT';
    if (editor) {
      updatePreview();
    }
    keepFocus(inputElement);
  }

  type HighlightSegment = { text: string; isMatch: boolean; start?: number };

  function getSearchSegments(): HighlightSegment[] {
    if (!editorText) return [];
    if (!searchMatches || searchMatches.length === 0) {
      return [{ text: editorText, isMatch: false }];
    }

    const segments: HighlightSegment[] = [];
    let lastIndex = 0;

    for (const match of searchMatches) {
      if (match.start > lastIndex) {
        segments.push({
          text: editorText.substring(lastIndex, match.start),
          isMatch: false,
        });
      }
      segments.push({
        text: editorText.substring(match.start, match.end),
        isMatch: true,
        start: match.start,
      });
      lastIndex = match.end;
    }

    if (lastIndex < editorText.length) {
      segments.push({
        text: editorText.substring(lastIndex),
        isMatch: false,
      });
    }

    return segments;
  }
</script>

<svelte:head>
  <title>{title}</title>
  <!-- Bulma CSS via CDN -->
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/bulma@1.0.4/css/bulma.min.css"
    crossorigin="anonymous"
  />
</svelte:head>

<!-- 
  Use a flexbox wrapper to fill the viewport height.
  'vh-100' is custom, but we can use inline style for the outer container 
  to ensure the app takes exactly the screen height.
-->
<div class="is-flex is-flex-direction-column" style="height: 100vh; overflow: hidden;">
  
  <!-- Header: Fixed height, tool button area -->
  <h1 class="title is-size-7 my-1 has-text-weight-normal">
    {title}
  </h1>
  <nav class="navbar px-3">
    <div class="navbar-start buttons">
      <button class="button is-small" onclick={stepBack}>
        <StepBack />
      </button>
      <button class="button is-small" onclick={stepForward}>
        <StepForward />
      </button>
      {#if mode === 'SEARCH'}
        <button class="button is-small" onclick={cancelSearch}>
          <X />
        </button>
      {:else}
        <button class="button is-small" onclick={enterSearchMode}>
          <Search />
        </button>
      {/if}
    </div>
  </nav>

  <!-- Preview Area: Expands to fill all remaining space -->
  <!-- mt-5 accounts for the fixed navbar height -->
  <main class="section p-3 is-flex-grow-1" style="overflow-y: auto;">
    <div class="content" style="white-space: pre-wrap;">
      {#if mode === 'SEARCH'}
        {#each getSearchSegments() as segment}
          {#if segment.isMatch && segment.start !== undefined}
            <button
              type="button"
              class="button is-text p-0 is-inline border-0 text-left font-weight-bold style-match-button"
              onclick={() => selectMatch(segment.start!)}
            >
              <strong>{segment.text}</strong>
            </button>
          {:else}
            {segment.text}
          {/if}
        {/each}
      {:else if mode === 'INPUT' || mode === null}
        {#if editor}
          {editorText.substring(0, windowRange[0])}<strong>{editorText.substring(windowRange[0], windowRange[1])}</strong>{editorText.substring(windowRange[1])}
        {/if}
      {:else}
        <span class="has-text-info">Preview will appear here…</span>
      {/if}
    </div>
  </main>

  <!-- Omni Box: Fixed to bottom -->
  <footer class="px-3 pb-3 pt-2">
    <div class="field">
      <div class="control">
        <input
          bind:this={inputElement}
          bind:value={inputText}
          class="input is-rounded"
          type="text"
          placeholder="Type text or commands..."
          onblur={() => keepFocus(inputElement)}
          oninput={(e) => {
            const target = e.target as HTMLInputElement;
            if (mode === 'SEARCH') {
              searchQuery = target.value;
              handleSearch();
            } else {
              if (editor) {
                editor.update(target.value);
                updatePreview();
              }
            }
          }}
          onkeydown={(e) => {
            if (e.key === 'Escape') {
              if (mode === 'SEARCH') {
                cancelSearch();
              } else {
                mode = null;
                keepFocus(inputElement);
              }
            } else if (mode === 'SEARCH' && e.key === 'Enter') {
              handleSearch();
            }
          }}
        />
      </div>
    </div>
  </footer>
</div>
