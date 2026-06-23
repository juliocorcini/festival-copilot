import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Map assets (SVG + transform) are served from /public/maps. The PWA reads them at
// runtime; in production they come from R2/D1 by festivalId (DEC-034 §11.7).
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, strictPort: false },
});
