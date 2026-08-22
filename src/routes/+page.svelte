<script lang="ts">
  import { onMount } from 'svelte';

  let text = '';
  let inputElement;

  // Keep the input focused to prevent keyboard flicker and layout shifts on mobile
  function keepFocus() {
    if (inputElement && document.activeElement !== inputElement) {
      inputElement.focus();
    }
  }

  onMount(() => {
    keepFocus();
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
