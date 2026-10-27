import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const MAX_MENTOR_BODY_BYTES = 24_000;

function localMentorApi(): Plugin {
  return {
    name: "opensource-buddy-local-mentor-api",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = request.url?.split("?")[0];
        if (requestPath !== "/api/ai-mentor") {
          next();
          return;
        }

        const chunks: Buffer[] = [];
        let bodyBytes = 0;
        let tooLarge = false;
        request.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          bodyBytes += buffer.byteLength;
          if (bodyBytes > MAX_MENTOR_BODY_BYTES) {
            tooLarge = true;
            chunks.length = 0;
            return;
          }
          if (!tooLarge) chunks.push(buffer);
        });

        request.on("end", () => {
          const json = (statusCode: number, value: unknown) => {
            response.statusCode = statusCode;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.end(JSON.stringify(value));
          };
          if (tooLarge) {
            json(413, { error: "Request body is too large. Shorten the issue description and try again." });
            return;
          }

          const adapter = {
            status(statusCode: number) {
              response.statusCode = statusCode;
              return this;
            },
            setHeader(name: string, value: string) {
              response.setHeader(name, value);
            },
            json(value: unknown) {
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              response.end(JSON.stringify(value));
            },
            end() {
              response.end();
            },
          };
          const body = Buffer.concat(chunks).toString("utf8");
          void import("./server/ai-mentor")
            .then(({ default: handler }) => handler({
              method: request.method,
              headers: request.headers,
              body,
            }, adapter))
            .catch(next);
        });
        request.on("error", next);
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    localMentorApi(),
    {
      name: "opensource-buddy-load-server-env",
      config(_, { mode }) {
        const env = loadEnv(mode, process.cwd(), "");
        for (const name of [
          "OPENROUTER_API_KEY",
          "OPENROUTER_MODEL",
          "APP_ORIGIN",
          "SUPABASE_URL",
          "SUPABASE_ANON_KEY",
          "VITE_SUPABASE_URL",
          "VITE_SUPABASE_ANON_KEY",
        ]) {
          if (env[name] && !process.env[name]) process.env[name] = env[name];
        }
      },
    },
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    clearMocks: true,
  },
});
