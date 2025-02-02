/// <reference types="vitest" />
import { defineConfig } from "vite";
import istanbul from "vite-plugin-istanbul";

import * as path from "path";
import react from "@vitejs/plugin-react";
import viteSentry from "vite-plugin-sentry";

export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
    viteSentry({
      url: "https://sentry.io",
      authToken: process.env.MARKETPLACE_SENTRY_AUTH_TOKEN,
      org: process.env.MARKETPLACE_SENTRY_ORG,
      project: process.env.MARKETPLACE_SENTRY_PROJECT,
      release: process.env.MARKETPLACE_SENTRY_RELEASE,
      deploy: {
        env: "production",
      },
      setCommits: {
        auto: true,
      },
      sourceMaps: {
        include: ["./dist/assets"],
        ignore: ["node_modules"],
        urlPrefix: "~/assets",
      },
      dryRun:
        !process.env.MARKETPLACE_SENTRY_AUTH_TOKEN ||
        !process.env.MARKETPLACE_SENTRY_ORG ||
        !process.env.MARKETPLACE_SENTRY_PROJECT ||
        !process.env.MARKETPLACE_SENTRY_RELEASE,
    }),
  ];

  if (mode === "test") {
    plugins.push(
      istanbul({
        include: "src/*",
        exclude: ["node_modules", "tests", "cypress", "App/tests", "*.config.ts", "*.config.js", ".eslintrc.js"],
        extension: [".ts", ".tsx", ".vue"],
        requireEnv: true,
        envPrefix: "MARKETPLACE_",
      })
    );
  }
  return {
    envPrefix: "MARKETPLACE_",
    plugins,
    resolve: {
      alias: {
        src: path.resolve(__dirname, "./src"),
        tests: path.resolve(__dirname, "./tests"),
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            starknet: ["@starknet-react/core", "get-starknet", "starknet"],
            "react-dom": ["react-dom"],
          },
          sourcemapExcludeSources: true,
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      coverage: {
        reporter: ["html", "clover"],
      },
    },
  };
});
