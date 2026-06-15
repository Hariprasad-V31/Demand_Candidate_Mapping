import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so built asset URLs work on GitHub Pages project sites
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: "./",
  plugins: [react()],
});
