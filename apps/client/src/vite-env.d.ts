// Type definitions for @ngx-env/builder environment variables
interface ImportMetaEnv {
  readonly NG_APP_API_URL: string;
  // Add other env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
