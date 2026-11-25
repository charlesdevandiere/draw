/** Short commit SHA of the running build, or "dev" for local builds. */
export const APP_VERSION: string = import.meta.env.VITE_COMMIT_SHA?.slice(0, 7) || 'dev';

/** Date of the build (ISO), set by vite.config.ts; null if missing. */
export const APP_BUILD_DATE: string | null = import.meta.env.VITE_BUILD_DATE ?? null;
