import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Self-contained server bundle for the Docker image (copies only what's needed).
  output: "standalone",
  // Pin the workspace root: a stray pnpm-lock.yaml in a parent dir otherwise
  // confuses Turbopack's root inference.
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
