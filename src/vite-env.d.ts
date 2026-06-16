/** Vite build-time environment variables available via import.meta.env. */
interface ImportMetaEnv {
  /** Base URL of the API when the client is hosted separately from the server. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
