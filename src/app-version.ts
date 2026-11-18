/** Short commit SHA of the running build, or « dev » for local builds. */
export const APP_VERSION: string = import.meta.env.VITE_COMMIT_SHA?.slice(0, 7) || 'dev';
