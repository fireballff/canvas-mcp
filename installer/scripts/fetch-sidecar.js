#!/usr/bin/env node
/**
 * Downloads Node.js LTS for the current platform and extracts canvas-mcp's
 * dist/index.js into src-tauri/resources/sidecar/.
 *
 * Uses execFileSync (not exec/execSync with strings) to avoid shell injection.
 * All arguments are passed as arrays, never interpolated into a shell string.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, cpSync, rmSync, createWriteStream, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SIDECAR_DIR = join(ROOT, "src-tauri", "resources", "sidecar");
const TMP = join(ROOT, ".tmp-canvas-mcp");
const NODE_VERSION = "v22.13.1"; // Node.js LTS — update as needed

mkdirSync(SIDECAR_DIR, { recursive: true });
mkdirSync(TMP, { recursive: true });

// --- canvas-mcp index.js ---
console.log("Fetching @fireballff/canvas-mcp...");
execFileSync("npm", ["pack", "@fireballff/canvas-mcp", "--pack-destination", TMP], { stdio: "inherit" });

const tarball = readdirSync(TMP)[0];
execFileSync("tar", ["-xzf", join(TMP, tarball), "-C", TMP], { stdio: "inherit" });

const distIndex = join(TMP, "package", "dist", "index.js");
if (!existsSync(distIndex)) {
  throw new Error(`Expected ${distIndex} — check canvas-mcp package structure`);
}
cpSync(distIndex, join(SIDECAR_DIR, "index.js"));
rmSync(TMP, { recursive: true });
console.log("✓ index.js copied");

// --- Node.js binary ---
const platform = process.platform;
const arch = process.arch === "arm64" ? "arm64" : "x64";

let nodePkg, extractedBinPath;
if (platform === "darwin") {
  nodePkg = `node-${NODE_VERSION}-darwin-${arch}.tar.gz`;
  extractedBinPath = join(SIDECAR_DIR, `node-${NODE_VERSION}-darwin-${arch}`, "bin", "node");
} else if (platform === "win32") {
  nodePkg = `node-${NODE_VERSION}-win-${arch}.zip`;
  extractedBinPath = join(SIDECAR_DIR, `node-${NODE_VERSION}-win-${arch}`, "node.exe");
} else {
  throw new Error(`Unsupported platform: ${platform}`);
}

const nodeUrl = `https://nodejs.org/dist/${NODE_VERSION}/${nodePkg}`;
const nodeOut = join(SIDECAR_DIR, nodePkg);

console.log(`Downloading Node.js ${NODE_VERSION} for ${platform}-${arch}...`);
await download(nodeUrl, nodeOut);
console.log("✓ Node.js downloaded");

if (platform === "darwin") {
  execFileSync("tar", ["-xzf", nodeOut, "-C", SIDECAR_DIR], { stdio: "inherit" });
  cpSync(extractedBinPath, join(SIDECAR_DIR, "node"));
  rmSync(nodeOut);
  rmSync(join(SIDECAR_DIR, `node-${NODE_VERSION}-darwin-${arch}`), { recursive: true });
} else {
  const zipEntry = `node-${NODE_VERSION}-win-${arch}/node.exe`;
  execFileSync("unzip", ["-o", nodeOut, zipEntry, "-d", SIDECAR_DIR], { stdio: "inherit" });
  cpSync(extractedBinPath, join(SIDECAR_DIR, "node.exe"));
  rmSync(nodeOut);
  rmSync(join(SIDECAR_DIR, `node-${NODE_VERSION}-win-${arch}`), { recursive: true });
}

console.log("✓ node binary ready at src-tauri/resources/sidecar/");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        rmSync(dest, { force: true });
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
    }).on("error", reject);
  });
}
