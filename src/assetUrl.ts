/**
 * Resolve a public-folder asset against the deployment base.
 *
 * Audio and image paths were written root-absolute ("/kick.mp3"), which is
 * correct for the dev server and for Tauri's asset protocol but 404s under a
 * GitHub Pages project site served from /<repo>/. Vite substitutes BASE_URL at
 * build time, so this costs nothing at runtime and keeps every surface honest.
 */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
