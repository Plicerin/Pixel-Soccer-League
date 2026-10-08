/** Version stamped in by vite from package.json at build time. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Deployment base path, set by vite. "/" locally, "/<repo>/" on Pages. */
  readonly BASE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
