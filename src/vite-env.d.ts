/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commit SHA injected by CI (absent in local builds). */
  readonly VITE_COMMIT_SHA?: string;
  /** Build date (ISO), set by vite.config.ts. */
  readonly VITE_BUILD_DATE?: string;
}
