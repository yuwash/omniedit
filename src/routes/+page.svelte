<script lang="ts">
  import { onMount } from 'svelte';
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
  let mode = $state<'INPUT' | 'SEARCH' | 'DOCUMENTS' | null>(null); // Tracks whether the omnibox is in INPUT, SEARCH, or DOCUMENTS mode
  let title = $derived(currentDocumentName ? currentDocumentName + ' - Omniedit' : 'Omniedit');
  let searchMatches = $state<{ text: string; start: number; end: number }[]>([]);
  let searchQuery = $state('');
  let documents = $state<DbDocument[]>([]); // List of all documents
  let currentDocumentId = $state<number | null>(null);
  let currentDocument = $derived<DbDocument | null>(documents.find((doc) => doc.id === currentDocumentId));
  let currentDocumentName = $derived(currentDocument ? currentDocument.name : '');
  let currentDocumentMarkedForDeletion = $state(false); // New state to track deletion marking

  // Track textarea selection for cursor indicator
  let selectionStart = $state(0);
  let selectionEnd = $state(0);

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
    return getRenderedInputParagraphs(editorText, windowRange);
  }

  async function switchToDocument(doc: DbDocument) {
    if (!editor) return;
    const documentChanged = currentDocument?.id !== doc.id;

    if (currentDocumentMarkedForDeletion && currentDocument) {
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

<div class="is-flex is-flex-direction-column" style="height: 100vh; overflow: hidden;">
  
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
          oninput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            if (mode === 'SEARCH') {
              searchQuery = target.value;
              handleSearch();
            } else if (mode === 'DOCUMENTS') {
              // Rename the current document
              if (currentDocument) {
                currentDocument.name = target.value;
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
      {#if mode === 'SEARCH' || mode === 'INPUT' || mode === null}
        {#each getRenderedParagraphs() as paragraph}
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
</style>
