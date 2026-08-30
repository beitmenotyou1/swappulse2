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
  // The default cache dir (node_modules/.vite) ended up holding chunks from two
  // different optimization runs, so a single page load pulled React from both
  // (?v=6da34daf AND ?v=586c7768) → two React copies → "Cannot read properties
  // of null (reading 'useState')" in the first hook call. Pointing Vite at a
  // fresh cache dir forces ONE complete optimization run, and unlike
  // `optimizeDeps.force` it stays stable across server restarts.
  cacheDir: 'node_modules/.vite-swappulse',
  // Pre-bundle ALL React entry points so Vite never discovers one mid-session
  // and triggers a re-optimization (which creates a new ?v= hash and mixes
  // old + new dep chunks → duplicate React copies → "Cannot read properties
  // of null (reading 'useState')"). NOTE: `force: true` is intentionally
  // omitted — it regenerates the ?v= hash on every server restart, so any
  // tab open across a restart ends up with chunks from two different
  // optimization runs. Without it, the hash stays stable across restarts
  // as long as dependencies don't change.
  optimizeDeps: {
    // Pre-bundle React core AND every React-using library imported by the
    // ~100 lazy-loaded pages. Without this, the first navigation to a lazy
    // page lets Vite "discover" a library (framer-motion, recharts, …) and
    // trigger a mid-session re-optimization — a new ?v= hash is generated
    // and the browser ends up with React chunks from two different
    // optimization runs → duplicate React copies → "Cannot read properties
    // of null (reading 'useState')". Pre-bundling them all upfront keeps
    // the hash stable for the whole session.
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'react-dom/client',
      'react-dom/test-utils',
      'scheduler',
      'react-router-dom',
      'framer-motion',
      '@tanstack/react-query',
      'react-hot-toast',
      'react-hook-form',
      'react-markdown',
      'lucide-react',
      'moment',
      'date-fns',
      'lodash',
    ],
  },
  resolve: {
    // Force a single copy of React/ReactDOM — prevents "Invalid hook call"
    // crashes caused by duplicate React copies (stale Vite dep cache, etc.).
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'scheduler'],
    alias: {
      // base44:runtime is a backend-only virtual module; mock it so Vite can
      // resolve shared modules that import it during the frontend build.
      'base44:runtime': '/src/base44-runtime-mock.js',
    },
  },
});