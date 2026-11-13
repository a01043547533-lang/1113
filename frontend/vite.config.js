import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 백엔드 주소. 8000번이 이미 쓰이고 있으면 API_URL=http://localhost:8010 npm run dev
const API_URL = process.env.API_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": API_URL },
  },
});
