/** Version stamped in by vite from package.json at build time. */
declare const __APP_VERSION__: string;

/** True in a static web build (itch.io / Pages): no dev-server routes exist. */
declare const __PSL_WEB_BUILD__: boolean;

interface ImportMetaEnv {
  /** Deployment base path, set by vite. "/" locally, "/<repo>/" on Pages, "./" on itch. */
  readonly BASE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
