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
  // The default dep cache (node_modules/.vite) holds chunks from two different
  // optimization runs, so one page load pulls React twice (?v=6da34daf and
  // ?v=586c7768) → "Cannot read properties of null (reading 'useState')".
  // Pointing at an unused cache dir forces one clean, self-consistent run.
  cacheDir: 'node_modules/.vite-clean',
  resolve: {
    alias: {
      // base44:runtime is a backend-only virtual module; mock it so Vite can
      // resolve shared modules that import it during the frontend build.
      'base44:runtime': '/src/base44-runtime-mock.js',
    },
  },
});