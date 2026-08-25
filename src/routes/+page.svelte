<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type Document as DbDocument } from '$lib/db';
  import { MovingWindowEditor } from '$lib/movingWindowEditor';
  import { StepBack, StepForward, Search, X, File } from '@lucide/svelte';

  let editorText = $state(''); // This will hold the full text for the preview
  let inputText = $state(''); // This will hold the value of the input field
  let windowRange = $state<[number, number]>([0, 0]); // Track current window bounds reactively
  let inputElement: HTMLInputElement;
  let currentDocument = $state<DbDocument | null>(null);
  let currentDocumentName = $state('');
  let editor = $state<MovingWindowEditor | null>(null);
  let mode = $state<'INPUT' | 'SEARCH' | 'DOCUMENTS' | null>(null); // Tracks whether the omnibox is in INPUT, SEARCH, or DOCUMENTS mode
  let title = $derived(currentDocumentName ? currentDocumentName + ' - Omniedit' : 'Omniedit');
  let searchMatches = $state<{ text: string; start: number; end: number }[]>([]);
  let searchQuery = $state('');
  let documents = $state<DbDocument[]>([]); // List of all documents

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
    
    // Load all documents for the file list
    loadDocuments();
  });

  // Load all documents from the database
  async function loadDocuments() {
    documents = await db.documents.toArray();
  }

  // Sync the full editor text to the database whenever it changes
  $effect(() => {
    if (editorText && currentDocument && editor) {
      db.documents.update(currentDocument.id, { content: editor.getText() });
      currentDocumentName = currentDocument.name;
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
      // Position cursor past the match so the match is included in the window
      const text = editor.getText();
      const nextLineBreak = text.indexOf('\n', start);
      const lineEnd = nextLineBreak !== -1 ? nextLineBreak : text.length;
      // Ideal cursor position is start + 50 or lineEnd
      const targetCursor = Math.min(lineEnd, Math.max(start + 1, start + 50));
      editor.setCursor(targetCursor);
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

  function openDocumentsList() {
    mode = 'DOCUMENTS';
    loadDocuments(); // Refresh the document list
    // Show the current document title in the omnibox for renaming
    inputText = currentDocumentName;
  }

  function closeDocumentsList() {
    mode = 'INPUT';
    // Restore the editor window in the omnibox
    updatePreview();
  }

  function switchToDocument(doc: DbDocument) {
    if (editor) {
      // Save current document content
      db.documents.update(currentDocument!.id, { content: editor.getText() });
    }
    
    // Load new document
    currentDocument = doc;
    editor = new MovingWindowEditor(doc.content, doc.content.length, 50, 100);
    
    // Update UI
    editorText = editor.getText();
    inputText = editor.getWindow();
    windowRange = editor.getWindowStartEnd();
    currentDocumentName = doc.name;
    mode = 'INPUT';
    
    keepFocus(inputElement);
  }

  type HighlightSegment = { text: string; isMatch: boolean; start?: number };

  type FormattedSegment =
    | { type: 'normal'; text: string }
    | { type: 'strong'; text: string }
    | { type: 'match'; text: string; start: number };

  function getRenderedParagraphs(): FormattedSegment[][] {
    if (mode === 'SEARCH') {
      const rawSegments = getSearchSegments();
      const paragraphs: FormattedSegment[][] = [[]];
      for (const seg of rawSegments) {
        const parts = seg.text.split('\n');
        for (let i = 0; i < parts.length; i++) {
          if (i > 0) {
            paragraphs.push([]);
          }
          if (parts[i]) {
            if (seg.isMatch && seg.start !== undefined) {
              paragraphs[paragraphs.length - 1].push({
                type: 'match',
                text: parts[i],
                start: seg.start,
              });
            } else {
              paragraphs[paragraphs.length - 1].push({
                type: 'normal',
                text: parts[i],
              });
            }
          }
        }
      }
      return paragraphs;
    }

    if (mode === 'DOCUMENTS') {
      // Show document list in preview area
      const paragraphs: FormattedSegment[][] = [[]];
      
      // Add header
      paragraphs[0].push({
        type: 'strong',
        text: 'Documents:'
      });
      
      // Add each document as a button
      for (const doc of documents) {
        paragraphs.push([]);
        paragraphs[paragraphs.length - 1].push({
          type: 'normal',
          text: '- '
        });
        paragraphs[paragraphs.length - 1].push({
          type: 'match',
          text: doc.name,
          start: 0
        });
      }
      
      return paragraphs;
    }

    if (!editor) return [];

    const [start, end] = windowRange;
    const before = editorText.substring(0, start);
    const windowed = editorText.substring(start, end);
    const after = editorText.substring(end);

    const segments: Array<{ type: 'normal' | 'strong'; text: string }> = [];
    if (before) segments.push({ type: 'normal', text: before });
    if (windowed) segments.push({ type: 'strong', text: windowed });
    if (after) segments.push({ type: 'normal', text: after });

    const paragraphs: FormattedSegment[][] = [[]];
    for (const seg of segments) {
      const parts = seg.text.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          paragraphs.push([]);
        }
        if (parts[i]) {
          paragraphs[paragraphs.length - 1].push(
            seg.type === 'strong'
              ? { type: 'strong', text: parts[i] }
              : { type: 'normal', text: parts[i] }
          );
        }
      }
    }

    return paragraphs;
  }

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
      {#if mode === 'INPUT'}
        <button class="button is-small" onclick={stepBack}>
          <StepBack />
        </button>
        <button class="button is-small" onclick={stepForward}>
          <StepForward />
        </button>
      {/if}
      {#if mode === 'SEARCH'}
        <button class="button is-small" onclick={cancelSearch}>
          <X />
        </button>
      {:else if mode === 'DOCUMENTS'}
        <button class="button is-small" onclick={closeDocumentsList}>
          <X />
        </button>
      {:else}
        <button class="button is-small" onclick={enterSearchMode}>
          <Search />
        </button>
        <button class="button is-small" onclick={openDocumentsList}>
          <File />
        </button>
      {/if}
    </div>
  </nav>

  <!-- Preview Area: Expands to fill all remaining space -->
  <!-- mt-5 accounts for the fixed navbar height -->
  <main class="section p-3 is-flex-grow-1" style="overflow-y: auto;">
    <div class="content">
      {#if mode === 'SEARCH' || mode === 'INPUT' || mode === null}
        {#each getRenderedParagraphs() as paragraph}
          <p>
            {#if paragraph.length === 0}
              <br />
            {:else}
              {#each paragraph as seg}
                {#if seg.type === 'match'}
                  <button
                    type="button"
                    class="button is-text p-0 is-inline border-0 text-left font-weight-bold style-match-button"
                    onclick={() => selectMatch(seg.start)}
                  >
                    <strong>{seg.text}</strong>
                  </button>
                {:else if seg.type === 'strong'}
                  <strong>{seg.text}</strong>
                {:else}
                  {seg.text}
                {/if}
              {/each}
            {/if}
          </p>
        {/each}
      {:else if mode === 'DOCUMENTS'}
        {#each documents as doc}
          {const isCurrent = currentDocument?.id === doc.id}
          {const docName = $derived(isCurrent ? currentDocumentName : doc.name)}
          <p class="document-with-preview">
            {#if isCurrent}⬤{/if}
            <button
              class="button is-text p-0"
              onclick={() => switchToDocument(doc)}
            >
              {#if docName}{docName}{:else}<i>Untitled</i>{/if}
            </button>: {doc.content.substring(0, 100)}
          </p>
        {/each}
      {:else}
        <p><span class="has-text-info">Preview will appear here…</span></p>
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
            } else if (mode === 'DOCUMENTS') {
              // Rename the current document
              currentDocumentName = target.value;
              if (currentDocument) {
                db.documents.update(currentDocument.id, { name: currentDocumentName });
                currentDocument.name = currentDocumentName;
              }
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
              } else if (mode === 'DOCUMENTS') {
                closeDocumentsList();
              } else {
                mode = null;
                keepFocus(inputElement);
              }
            } else if (mode === 'SEARCH' && e.key === 'Enter') {
              handleSearch();
            } else if (mode === 'INPUT' && e.key === 'Enter') {
              // Insert newline at current window selection position in omnibox
              if (editor) {
                const target = e.target as HTMLInputElement;
                const selectionStart = target.selectionStart ?? target.value.length;
                const windowStart = editor.getWindowStartEnd()[0];
                const insertPos = windowStart + selectionStart;
                editor.splitLine(insertPos);
                updatePreview();
                keepFocus(inputElement);
              }
            } else if (mode === 'INPUT' && e.key === 'Backspace') {
              if (editor) {
                const target = e.target as HTMLInputElement;
                const selectionStart = target.selectionStart ?? 0;
                const selectionEnd = target.selectionEnd ?? 0;
                // Check if omnibox is empty and selection is at 0
                if (selectionStart === 0 && selectionEnd === 0 && editor.windowIsAtLineStart) {
                  editor.mergeWithPreviousLine();
                  updatePreview();
                  keepFocus(inputElement);
                }
              }
            }
          }}
        />
      </div>
    </div>
  </footer>
</div>

<style>
  .document-with-preview {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
