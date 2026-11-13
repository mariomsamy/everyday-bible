/** package.json version, injected by Vite at build time. */
declare const __APP_VERSION__: string;
/** Build commit (7 characters). Outside GitHub Actions it is "dev". */
declare const __APP_BUILD__: string;

interface ImportMetaEnv {
  /** AI Worker URL. Empty: the feature is off. Set at deploy time by the repository's AI_URL variable. */
  readonly VITE_AI_URL?: string;
  /** '1' only when the daily-devotional content packs exist in public/devotional/. Off by default. */
  readonly VITE_DEVOTIONAL?: string;
}
