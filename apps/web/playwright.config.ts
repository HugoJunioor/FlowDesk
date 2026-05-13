import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test",
  use: {
    baseURL: "https://localhost:8080",
  },
});
