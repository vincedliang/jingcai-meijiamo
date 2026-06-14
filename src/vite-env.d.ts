/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_PASSCODE?: string;
  readonly VITE_APP_PASSCODE_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
