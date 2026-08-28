import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  // Keep a stable dep cache across dev server restarts. `force: true` was
  // previously set to "prevent stale chunks", but it actually CAUSES duplicate
  // React copies: each restart generates a new ?v= hash, so the browser's
  // HTTP-cached chunks from the old hash get served alongside fresh ones.
  // With a stable hash + dedupe below, the browser caches one consistent set.
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  resolve: {
    // Force a single copy of React/ReactDOM — prevents "Invalid hook call"
    // crashes caused by duplicate React copies (stale Vite dep cache, etc.).
    dedupe: ['react', 'react-dom'],
    alias: {
      // base44:runtime is a backend-only virtual module; mock it so Vite can
      // resolve shared modules that import it during the frontend build.
      'base44:runtime': '/src/base44-runtime-mock.js',
    },
  },
});