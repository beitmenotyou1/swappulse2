// Frontend mock for the backend-only "base44:runtime" virtual module.
// The real module is only available in the Deno backend runtime; Vite
// encounters it when scanning base44/shared/ modules and fails to resolve
// it. This mock provides a no-op `secrets.get()` so the build succeeds.
// Shared modules that use `secrets` are only ever called from backend
// functions, never from frontend code.
export const secrets = {
  get: () => undefined,
};