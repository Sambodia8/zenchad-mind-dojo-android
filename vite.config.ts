import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import preBikeWarmupPlugin from "./preBikeWarmupPlugin";

export default defineConfig({
  plugins: [preBikeWarmupPlugin(), react()],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173
  }
});
