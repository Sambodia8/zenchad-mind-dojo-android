/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VALHALLA_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
