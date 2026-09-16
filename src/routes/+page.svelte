<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { db, type Document as DbDocument } from '$lib/db';
  import { MovingWindowEditor } from '$lib/movingWindowEditor';
  import { getRenderedSearchParagraphs, getRenderedInputParagraphs, getRenderedDocumentsParagraphs } from '$lib/segmentation';
  import type { FormattedSegment } from '$lib/segmentation';
  import { StepBack, StepForward, Search, X, File, Trash, FilePlus, ClipboardCopy, Download } from '@lucide/svelte';

  let inputText = $state(''); // This will hold the value of the input field
  let windowRange = $state<[number, number]>([0, 0]); // Track current window bounds reactively
  let omniboxElement: HTMLTextAreaElement;
  let editor = $state<MovingWindowEditor | null>(null);
  let editorText = $derived(editor ? editor.getText() : ''); // This will hold the full text for the preview
  let mode = $state<'INPUT' | 'SEARCH' | 'DOCUMENTS' | 'PARAGRAPH' | null>(null); // Tracks whether the omnibox is in INPUT, SEARCH, or DOCUMENTS mode
  let searchMatches = $state<{ text: string; start: number; end: number }[]>([]);
  let searchQuery = $state('');
  let documents = $state<DbDocument[]>([]); // List of all documents
  let currentDocumentId = $state<number | null>(null);
  let currentDocument = $derived<DbDocument | null>(documents.find((doc) => doc.id === currentDocumentId) ?? null);
  let currentDocumentName = $derived(currentDocument ? currentDocument.name : '');
  let title = $derived(currentDocumentName ? currentDocumentName + ' - Omniedit' : 'Omniedit');
  let currentDocumentMarkedForDeletion = $state(false); // New state to track deletion marking
  let paragraphStart = $state<number | null>(null); // Track paragraph start position for paragraph mode
  let paragraphEnd = $state<number | null>(null); // Track paragraph end position for paragraph mode

  // Track textarea selection for cursor indicator
  let selectionStart = $state(0);
  let selectionEnd = $state(0);

  // Track IME composition state (e.g. Japanese Kanji input conversion)
  let isComposing = $state(false);

  // Keep the input focused to prevent keyboard flicker and layout shifts on mobile
  function keepFocus(element: HTMLTextAreaElement | null) {
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
    currentDocumentId = doc.id;

    // Initialize the MovingWindowEditor with the document's full content
    editor = new MovingWindowEditor(doc.content, doc.content.length, 50, 100);

    // Set the input field's initial value to the current window
    inputText = editor.getWindow();

    updatePreview();
    keepFocus(omniboxElement);
    mode = 'INPUT';
    
    // Load all documents for the file list
    loadDocuments();
  });

  // Load all documents from the database
  async function loadDocuments() {
    documents = await db.documents.toArray();
  }

  // Sync the full editor text to the database whenever it changes
  $effect(() => {
    if (currentDocumentId && editorText) {
      db.documents.update(currentDocumentId, { content: editorText });
    }
  });

  // Sync the current document name to the database whenever it changes
  $effect(() => {
    if (currentDocumentId && currentDocumentName) {
      db.documents.update(currentDocumentId, { name: currentDocumentName });
    }
  });

  function updateSelection() {
    if (omniboxElement) {
      selectionStart = omniboxElement.selectionStart;
      selectionEnd = omniboxElement.selectionEnd;
    }
  }

  async function applyOmniboxInput() {
    if (mode === 'SEARCH') {
      searchQuery = omniboxElement.value;
      handleSearch();
    } else if (mode === 'DOCUMENTS') {
      // Rename the current document
      if (currentDocument) {
        currentDocument.name = omniboxElement.value;
      }
    } else if (mode === 'PARAGRAPH') {
      // Update the paragraph content
      if (editor && paragraphStart !== null && paragraphEnd !== null) {
        const newParagraphText = omniboxElement.value;
        editor.replaceRange(paragraphStart, paragraphEnd, newParagraphText);
        paragraphEnd = paragraphStart + newParagraphText.length;
        updatePreview();
      }
    } else {
      if (editor) {
        const oldStart = editor.getWindowStartEnd()[0];
        const selStart = omniboxElement ? omniboxElement.selectionStart : 0;
        const selEnd = omniboxElement ? omniboxElement.selectionEnd : 0;

        editor.update(omniboxElement.value);
        updatePreview();

        const newStart = editor.getWindowStartEnd()[0];
        const deltaStart = newStart - oldStart;

        if (deltaStart !== 0 && omniboxElement) {
          await tick();
          const maxLen = omniboxElement.value.length;
          const newSelStart = Math.max(0, Math.min(maxLen, selStart - deltaStart));
          const newSelEnd = Math.max(0, Math.min(maxLen, selEnd - deltaStart));
          omniboxElement.setSelectionRange(newSelStart, newSelEnd);
          updateSelection();
        }
      }
    }
  }

  function stepBack() {
    if (editor) {
      editor.moveCursorByWindowSize(-1);
      updatePreview();
      keepFocus(omniboxElement);
    }
  }

  function stepForward() {
    if (editor) {
      editor.moveCursorByWindowSize(1);
      updatePreview();
      keepFocus(omniboxElement);
    }
  }

  function updatePreview() {
    if (editor) {
      editorText = editor.getText();
      if (mode !== 'PARAGRAPH') {
        inputText = editor.getWindow();
      }
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
      keepFocus(omniboxElement); // Focus the main input
    }
  }

  function enterSearchMode() {
    searchQuery = inputText;
    mode = 'SEARCH';
    handleSearch();
    keepFocus(omniboxElement);
  }

  function cancelSearch() {
    searchQuery = '';
    searchMatches = [];
    mode = 'INPUT';
    if (editor) {
      updatePreview();
    }
    keepFocus(omniboxElement);
  }

  function openDocumentsList() {
    mode = 'DOCUMENTS';
    loadDocuments(); // Refresh the document list
    // Show the current document title in the omnibox for renaming
    inputText = currentDocumentName;
    keepFocus(omniboxElement);
  }

  function closeDocumentsList() {
    mode = 'INPUT';
    // Restore the editor window in the omnibox
    updatePreview();
    keepFocus(omniboxElement);
  }

  // New function to mark the current document for deletion
  async function deleteCurrentDocument() {
    if (!currentDocument) return;
    currentDocumentMarkedForDeletion = true;
  }

  // New function to add a new document
  async function addNewDocument() {
    // Create a new document with empty content
    const id = await db.documents.add({ name: '', content: '' });
    const newDoc: DbDocument = { id, name: '', content: '' };
    // Set as current document
    currentDocumentId = newDoc.id;
    currentDocumentMarkedForDeletion = false;
    editor = new MovingWindowEditor('', 0, 50, 100);
    // Keep in DOCUMENTS mode so user can rename
    mode = 'DOCUMENTS';
    // Refresh document list to include the new one
    await loadDocuments();
    // Update UI
    inputText = editor.getWindow();
    windowRange = editor.getWindowStartEnd();
    keepFocus(omniboxElement);
  }

  async function copyCurrentDocument() {
    if (!currentDocument) return;
    try {
      await navigator.clipboard.writeText(currentDocument.content);
      // Optional: provide user feedback (e.g., toast) – omitted for brevity
    } catch (e) {
      console.error('Failed to copy document:', e);
    }
  }

  async function downloadCurrentDocument() {
    if (!currentDocument) return;
    const blob = new Blob([currentDocument.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = currentDocument.name ? `${currentDocument.name}.txt` : 'Untitled.txt';
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getRenderedParagraphs(): FormattedSegment[][] {
    if (mode === 'SEARCH') {
      return getRenderedSearchParagraphs(editorText, searchMatches);
    }
    if (mode === 'DOCUMENTS') {
      return getRenderedDocumentsParagraphs(documents);
    }
    if (mode === 'PARAGRAPH' && paragraphStart !== null && paragraphEnd !== null) {
      return getRenderedInputParagraphs(editorText, [paragraphStart, paragraphEnd]);
    }
    return getRenderedInputParagraphs(editorText, windowRange);
  }

  async function switchToDocument(doc: DbDocument) {
    if (!editor) return;
    const documentChanged = currentDocument?.id !== doc.id;

    if (currentDocumentMarkedForDeletion && currentDocument && currentDocumentId !== null) {
      if (documentChanged) {
        // Delete the currently marked document
        await db.documents.delete(currentDocumentId);
        currentDocumentMarkedForDeletion = false;
      } else {
        // Unmark and keep the same document
        currentDocumentMarkedForDeletion = false;
        updatePreview();
      }
    }

    if (documentChanged) {
      // Save current document content
      await db.documents.update(currentDocument!.id, { content: editor.getText() });

      // Load new document
      currentDocumentId = doc.id;
      editor = new MovingWindowEditor(doc.content, doc.content.length, 50, 100);

      // Update UI
      inputText = editor.getWindow();
      windowRange = editor.getWindowStartEnd();
    }
    mode = 'INPUT';
    keepFocus(omniboxElement);
  }

  // Paragraph Mode functions
  function enterParagraphMode(paragraphIndex: number) {
    if (!editor) return;

    const fullText = editor.getText();
    const paragraphs = fullText.split('\n');
    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) return;

    let start = 0;
    for (let i = 0; i < paragraphIndex; i++) {
      start += paragraphs[i].length + 1; // +1 for newline
    }
    const paragraphText = paragraphs[paragraphIndex];
    const end = start + paragraphText.length;

    paragraphStart = start;
    paragraphEnd = end;
    inputText = paragraphText;
    mode = 'PARAGRAPH';
    keepFocus(omniboxElement);
  }

  function exitParagraphMode() {
    const targetCursor = paragraphEnd;
    mode = 'INPUT';
    paragraphStart = null;
    paragraphEnd = null;
    if (editor && targetCursor !== null) {
      editor.setCursor(targetCursor);
    }
    updatePreview();
    keepFocus(omniboxElement);
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

<div class="is-flex is-flex-direction-column" style="min-height: 100vh;">
  
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
      {:else if mode === 'PARAGRAPH'}
        <button class="button is-small" onclick={exitParagraphMode}>
          <X />
        </button>
      {:else if mode === 'DOCUMENTS'}
        <button class="button is-small" onclick={closeDocumentsList}>
          <X />
        </button>
        <button class="button is-small" onclick={addNewDocument}>
          <FilePlus />
        </button>
        <button class="button is-small" onclick={copyCurrentDocument}>
          <ClipboardCopy />
        </button>
        <button class="button is-small" onclick={downloadCurrentDocument}>
          <Download />
        </button>
        <button class="button is-small is-danger" onclick={deleteCurrentDocument}>
          <Trash />
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

  <main class="section p-3">
    <div class="field">
      <div class="control">
        <textarea
          bind:this={omniboxElement}
          bind:value={inputText}
          class="textarea"
          rows="1"
          placeholder="Type text or commands..."
          oncompositionstart={() => {
            isComposing = true;
          }}
          oncompositionend={(e) => {
            isComposing = false;
            applyOmniboxInput();
          }}
          oninput={(e) => {
            if (isComposing) return;
            applyOmniboxInput();
          }}
          onkeydown={(e) => {
            if (isComposing || e.isComposing) return;
            if (e.key === 'Escape') {
              if (mode === 'SEARCH') {
                cancelSearch();
              } else if (mode === 'DOCUMENTS') {
                closeDocumentsList();
              } else if (mode === 'PARAGRAPH') {
                exitParagraphMode();
              } else {
                mode = null;
                keepFocus(omniboxElement);
              }
            } else if (mode === 'SEARCH' && e.key === 'Enter') {
              handleSearch();
            } else if (mode === 'INPUT' && e.key === 'Enter') {
              // Insert newline at current window selection position in omnibox
              if (editor) {
                e.preventDefault(); // Prevent the browser from adding a second native newline
                const target = e.target as HTMLTextAreaElement;
                const windowStart = editor.getWindowStartEnd()[0];
                const insertPos = windowStart + selectionStart;
                editor.splitLine(insertPos);
                updatePreview();
                keepFocus(omniboxElement);
              }
            } else if (mode === 'INPUT' && e.key === 'Backspace') {
              if (editor) {
                const target = e.target as HTMLTextAreaElement;
                // Check if omnibox is empty and selection is at 0
                if (selectionStart === 0 && selectionEnd === 0 && editor.windowIsAtLineStart) {
                  e.preventDefault();
                  editor.mergeWithPreviousLine();
                  updatePreview();
                  keepFocus(omniboxElement);
                }
              }
            }
          }}
          onkeyup={updateSelection}
          onclick={updateSelection}
          onselect={updateSelection}
        ></textarea>
      </div>
    </div>
    <div class="content">
      {#if mode === 'SEARCH' || mode === 'INPUT' || mode === 'PARAGRAPH' || mode === null}
        {#each getRenderedParagraphs() as paragraph, pIndex}
          {#if mode === 'INPUT' || mode === 'PARAGRAPH'}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
            <p class="pre-wrap" onclick={() => enterParagraphMode(pIndex)} style="cursor: pointer;">
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
          {:else}
            <p class="pre-wrap">
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
          {/if}
        {/each}
      {:else if mode === 'DOCUMENTS'}
        {#each documents as doc}
          {const isCurrent = $derived(currentDocument?.id === doc.id)}
          {const docName = $derived(isCurrent ? currentDocumentName : doc.name)}
          <p class="document-with-preview">
            {#if isCurrent}{#if currentDocumentMarkedForDeletion}↶{:else}⬤{/if}{/if}
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
</div>

<style>
  .document-with-preview {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pre-wrap {
    /* Visible leading whitespaces */
    white-space: pre-wrap;
  }
  
  /* Add hover effect for clickable paragraphs */
  p.pre-wrap:hover {
    background-color: rgba(0, 0, 0, 0.02);
    transition: background-color 0.2s ease;
  }
</style>
