import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    __APP_BUILD_ID__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.VERCEL_DEPLOYMENT_ID ||
        `local-${Date.now()}`,
    ),
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    sourcemap: false,
    manifest: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        support: path.resolve(__dirname, "support.html"),
        admin: path.resolve(__dirname, "admin.html"),
        intern: path.resolve(__dirname, "intern.html"),
        garage: path.resolve(__dirname, "garage.html"),
      },
      output: {
        manualChunks: {
          "vendor-react": [
            "react",
            "react-dom",
            "react-router-dom",
            "react-helmet-async",
          ],
          "vendor-state": ["@reduxjs/toolkit", "react-redux"],
        },
      },
    },
  },

  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
  },

  preview: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
  },
});
