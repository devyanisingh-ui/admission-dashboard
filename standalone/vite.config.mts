/**
 * Single-file build of the dashboard: `npm run build:html` writes the folder
 * dist-html/Apeejay Admissions Dashboard/ — copy it to any computer and double-click the HTML file inside:
 *   apeejay-admissions-dashboard.html   the whole dashboard; all JavaScript, CSS and the Inter font inlined,
 *                                       so it needs no server, no install and no internet
 *   How to open.txt                     instructions for the person receiving it
 *   Inter font licence.txt              the font's SIL Open Font License, which must travel with it
 *
 * It bundles the real app (app/, components/, lib/) with Vite instead of Next.js. The only Next.js
 * pieces the app uses — next/link and next/navigation — are swapped for small hash-router stand-ins
 * in this folder, so page URLs look like apeejay-admissions-dashboard.html#/budget.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const FOLDER = "Apeejay Admissions Dashboard";
const OUT_NAME = "apeejay-admissions-dashboard.html";

/** Fails the build if a page folder under app/ is missing from ROUTES in main.tsx. */
function checkRoutes(): Plugin {
  return {
    name: "check-routes",
    buildStart() {
      const main = readFileSync(resolve(here, "main.tsx"), "utf8");
      const pages = readdirSync(resolve(root, "app"), { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(resolve(root, "app", d.name, "page.tsx")))
        .map((d) => `/${d.name}`);
      const missing = pages.filter((p) => !main.includes(`"${p}":`));
      if (missing.length) this.error(`standalone/main.tsx ROUTES is missing: ${missing.join(", ")} — add the page there.`);
    },
  };
}

/** Puts the HTML file in the ready-to-copy folder, with the instructions and the font licence beside it. */
function packageFolder(): Plugin {
  return {
    name: "package-folder",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const f of Object.values(bundle)) if (f.fileName.endsWith(".html")) f.fileName = `${FOLDER}/${OUT_NAME}`;
      // Windows line endings so the text files read well in Notepad.
      const crlf = (t: string) => t.replace(/\r?\n/g, "\r\n");
      this.emitFile({ type: "asset", fileName: `${FOLDER}/How to open.txt`, source: crlf(readFileSync(resolve(here, "How to open.txt"), "utf8")) });
      this.emitFile({
        type: "asset", fileName: `${FOLDER}/Inter font licence.txt`,
        source: crlf(readFileSync(resolve(root, "node_modules/@fontsource-variable/inter/LICENSE"), "utf8")),
      });
    },
  };
}

export default defineConfig({
  // The repo root, so Tailwind finds every class used in app/, components/ and lib/.
  root,
  publicDir: false,
  plugins: [checkRoutes(), react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true }), packageFolder()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: resolve(here, "next-link.tsx") },
      { find: /^next\/navigation$/, replacement: resolve(here, "next-navigation.ts") },
      { find: /^@\//, replacement: `${root}/` },
    ],
  },
  build: {
    outDir: resolve(root, "dist-html"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(here, "index.html"),
      onwarn(w, warn) {
        // The app's "use client" lines are for Next.js; a single-page bundle ignores them.
        if (w.code === "MODULE_LEVEL_DIRECTIVE") return;
        warn(w);
      },
    },
    chunkSizeWarningLimit: 4000,
    reportCompressedSize: false,
  },
});
