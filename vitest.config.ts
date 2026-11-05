import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests execute handlers directly, without Start's RPC source transform.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node" },
});