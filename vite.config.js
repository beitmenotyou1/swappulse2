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
  // Force re-optimization on every server start (new ?v= hash) so the browser
  // can't serve stale dep chunks from a previous run. Explicitly include
  // react/react-dom so Vite always pre-bundles them into a single dep chunk.
  optimizeDeps: {
    force: true,
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
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