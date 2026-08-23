<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { MovingWindowEditor } from '$lib/movingWindowEditor';

  let editorText = $state(''); // This will hold the full text for the preview
  let inputText = $state(''); // This will hold the value of the input field
  let inputElement: HTMLInputElement;
  let currentDocument: db.Document | null = null;
  let editor: MovingWindowEditor | null = null;
  let mode = $state<'INPUT' | null>(null); // Tracks whether the omnibox is in INPUT mode
  let title = $state('');

  // Keep the input focused to prevent keyboard flicker and layout shifts on mobile
  function keepFocus() {
    if (inputElement && document.activeElement !== inputElement) {
      inputElement.focus();
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

    keepFocus();
  });

  // Sync the full editor text to the database whenever it changes
  $effect(() => {
    if (editorText) {
      db.documents.update(currentDocument.id, { content: editor.getText() });
      title = currentDocument.name + ' – Omniedit';
    }

    if (!mode && inputText !== '') {
      // Whenever the input value changes, update the editor and set
      // the mode to "INPUT".
      mode = 'INPUT';
    }
  });
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
  <nav class="navbar is-small px-3" style="min-height: 3rem;">
    <div class="navbar-brand">
      <h1 class="title is-size-7 has-text-weight-normal">
        {title}
      </h1>
    </div>
  </nav>

  <!-- Preview Area: Expands to fill all remaining space -->
  <!-- mt-5 accounts for the fixed navbar height -->
  <main class="section mt-5 px-3 py-4 is-flex-grow-1" style="overflow-y: auto;">
    <div class="content" style="white-space: pre-wrap;">
      {#if mode === 'INPUT'}
        {#if editor}
          {@html editorText.substring(0, editor.getWindowStartEnd()[0])}
          <strong>{editorText.substring(editor.getWindowStartEnd()[0], editor.getWindowStartEnd()[1])}</strong>
          {@html editorText.substring(editor.getWindowStartEnd()[1])}
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
          onblur={keepFocus}
          oninput={(e) => {
            if (editor) {
              editor.update(e.target.value);
              // Update the preview text to reflect the full content after the update
              editorText = editor.getText();
              // Keep the inputText bound to the editor's current window
              inputText = editor.getWindow();
            }
          }}
        />
      </div>
    </div>
  </footer>
</div>
