/// <reference types="vite/client" />

// Build-time Git commit SHA baked in via vite.config.ts `define`.
// Falls back to 'dev' for local builds without CI env vars.
declare const __COMMIT_SHA__: string;
