import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: "Omniedit",
				short_name: "Omniedit",
				description: "Mobile-first extremely space-efficient text editor using an omnibox.",
				icons: [
					{
						src: "lucide-text-cursor-input.svg",
						sizes: "256x256",
						type: "image/svg+xml"
					},
					{
						src: "lucide-text-cursor-input-192.png",
						sizes: "192x192",
						type: "image/png"
					}
				],
				start_url: ".",
				display: "standalone",
				theme_color: "#4258ff",
				background_color: "#ffffff"
			}
		})
	],
  ssr: {
    noExternal: ['@lucide/svelte']
  }
});
