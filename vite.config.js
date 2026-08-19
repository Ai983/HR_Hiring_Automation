import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env from config dir and from cwd (where you run npm run dev)
function loadEnvFromFile() {
  const out = {};
  const tryPath = (envPath) => {
    try {
      const content = fs.readFileSync(envPath, "utf8").replace(/\r/g, "");
      content.split("\n").forEach((line) => {
        const t = line.trim();
        if (!t || t.startsWith("#")) return;
        const m = line.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+)$/);
        if (m) out.VITE_SUPABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
        const m2 = line.match(/^\s*VITE_SUPABASE_ANON_KEY\s*=\s*(.+)$/);
        if (m2) out.VITE_SUPABASE_ANON_KEY = m2[1].trim().replace(/^["']|["']$/g, "");
      });
    } catch (_) {}
  };
  tryPath(path.join(__dirname, ".env"));
  if (!out.VITE_SUPABASE_URL || !out.VITE_SUPABASE_ANON_KEY) {
    tryPath(path.join(process.cwd(), ".env"));
  }
  if (!out.VITE_SUPABASE_URL || !out.VITE_SUPABASE_ANON_KEY) {
    console.warn("[HireFlow] .env not found or missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Tried:", path.join(__dirname, ".env"), "and", path.join(process.cwd(), ".env"));
  }
  return out;
}

const env = loadEnvFromFile();

// Write env.generated.js so the app always gets values (avoids define/import.meta issues)
const generatedPath = path.join(__dirname, "src", "env.generated.js");
fs.writeFileSync(
  generatedPath,
  `// Auto-generated from .env – do not edit. Restart dev server after changing .env.\nexport const VITE_SUPABASE_URL = ${JSON.stringify(env.VITE_SUPABASE_URL || "")};\nexport const VITE_SUPABASE_ANON_KEY = ${JSON.stringify(env.VITE_SUPABASE_ANON_KEY || "")};\n`,
  "utf8"
);

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  envDir: __dirname,
  define: {
    __VITE_SUPABASE_URL__: JSON.stringify(env.VITE_SUPABASE_URL || ""),
    __VITE_SUPABASE_ANON_KEY__: JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ""),
  },
  build: {
    rollupOptions: {
      input: {
        main:   path.join(__dirname, "index.html"),
        attend: path.join(__dirname, "attend.html"),
        test:   path.join(__dirname, "test.html"),
      },
    },
  },
});
