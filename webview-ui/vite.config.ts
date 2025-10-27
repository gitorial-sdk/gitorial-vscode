import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  base: './', // Use relative paths for VS Code webview compatibility
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),      // Tutorial webview panel
        changes: resolve(__dirname, 'changes.html'),  // Changes sidebar view
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
