<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';

  let text = $state(''); // Declare text as reactive state
  let inputElement: HTMLInputElement;
  let currentDocument: db.Document | null = null;

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
    text = doc.content;
    keepFocus();
  });

  // Update the document in the database whenever text changes using $effect
  $effect(() => {
    if (currentDocument) {
      db.documents.update(currentDocument.id, { content: text });
    }
  });
</script>

<svelte:head>
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
      <!-- Tool buttons will go here in future versions -->
    </div>
  </nav>

  <!-- Preview Area: Expands to fill all remaining space -->
  <!-- mt-5 accounts for the fixed navbar height -->
  <main class="section mt-5 px-3 py-4 is-flex-grow-1" style="overflow-y: auto;">
    <div class="content" style="white-space: pre-wrap;">
      {#if text}
        {text}
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
          bind:value={text}
          class="input is-rounded" 
          type="text" 
          placeholder="Type text or commands..."
          on:blur={keepFocus}
        />
      </div>
    </div>
  </footer>
</div>
