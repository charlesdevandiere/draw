/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Commit SHA injected by CI (absent in local builds). */
  readonly VITE_COMMIT_SHA?: string;
}
