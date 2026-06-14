import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/jingcai-meijiamo/",
  plugins: [react()],
  test: {
    environment: "node",
    globals: true
  }
});
