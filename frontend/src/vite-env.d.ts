/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ปลายทางของ REST API — ดู .env.example · ไม่ตั้งค่า = http://localhost:8080 */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
