import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/omniedit/',
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: '404.html',
				precompress: false,
				strict: true
			}),
			prerender: {
				// Handle cases where links might point to IDs that don't exist.
				// See https://svelte.dev/docs/kit/configuration#prerender-handleMissingId
				handleMissingId: ({ id, path }) => {
					console.warn(`Missing ID "${id}" on page "${path}"`);
					// Returning a path here will cause SvelteKit to redirect to that path
					// instead of throwing an error. For this case, we just want to warn.
				}
			}
		})
	],
  ssr: {
    noExternal: ['@lucide/svelte']
  }
});
