#!/usr/bin/env node
/**
 * Downloads Node.js LTS for the current platform and extracts canvas-mcp's
 * dist/index.js into src-tauri/resources/sidecar/.
 *
 * Uses execFileSync (not exec/execSync with strings) to avoid shell injection.
 * All arguments are passed as arrays, never interpolated into a shell string.
 */
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, cpSync, rmSync, createWriteStream, readdirSync, readFileSync, createReadStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SIDECAR_DIR = join(ROOT, "src-tauri", "resources", "sidecar");
const TMP = join(ROOT, ".tmp-canvas-mcp");
const NODE_VERSION = "v22.13.1"; // Node.js LTS — update as needed
const ALLOWED_DOWNLOAD_HOST = "nodejs.org";
const MAX_REDIRECTS = 5;

mkdirSync(SIDECAR_DIR, { recursive: true });
mkdirSync(TMP, { recursive: true });

// npm_execpath is set by npm when it spawns this script via `npm run prepare:sidecar`.
// Running it via process.execPath avoids any shell invocation on all platforms
// (no cmd.exe /c needed on Windows, no shell: true needed anywhere).
function npmExec(args) {
  const npmScript = process.env.npm_execpath;
  if (npmScript) {
    execFileSync(process.execPath, [npmScript, ...args], { stdio: "inherit" });
  } else {
    execFileSync("npm", args, { stdio: "inherit" });
  }
}

// --- canvas-mcp index.js ---
console.log("Fetching @fireballff/canvas-mcp...");
npmExec(["pack", "@fireballff/canvas-mcp", "--pack-destination", TMP]);

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

const nodeUrl = `https://${ALLOWED_DOWNLOAD_HOST}/dist/${NODE_VERSION}/${nodePkg}`;
const nodeOut = join(SIDECAR_DIR, nodePkg);

console.log(`Downloading Node.js ${NODE_VERSION} for ${platform}-${arch}...`);
await download(nodeUrl, nodeOut);
console.log("✓ Node.js downloaded");

console.log("Verifying SHA-256 checksum...");
await verifyChecksum(nodeOut, nodePkg);
console.log("✓ Checksum verified");

if (platform === "darwin") {
  execFileSync("tar", ["-xzf", nodeOut, "-C", SIDECAR_DIR], { stdio: "inherit" });
  cpSync(extractedBinPath, join(SIDECAR_DIR, "node"));
  rmSync(nodeOut);
  rmSync(join(SIDECAR_DIR, `node-${NODE_VERSION}-darwin-${arch}`), { recursive: true });
} else {
  // Windows runners (2019+) ship bsdtar which handles zip files
  execFileSync("tar", ["-xf", nodeOut, "-C", SIDECAR_DIR], { stdio: "inherit" });
  cpSync(extractedBinPath, join(SIDECAR_DIR, "node.exe"));
  rmSync(nodeOut);
  rmSync(join(SIDECAR_DIR, `node-${NODE_VERSION}-win-${arch}`), { recursive: true });
}

console.log("✓ node binary ready at src-tauri/resources/sidecar/");

async function verifyChecksum(filePath, expectedPkg) {
  const shasumsUrl = `https://${ALLOWED_DOWNLOAD_HOST}/dist/${NODE_VERSION}/SHASUMS256.txt`;
  const shasumsOut = join(SIDECAR_DIR, "SHASUMS256.txt");
  await download(shasumsUrl, shasumsOut);

  const lines = readFileSync(shasumsOut, "utf8").split("\n");
  rmSync(shasumsOut);

  const line = lines.find((l) => l.endsWith(`  ${expectedPkg}`));
  if (!line) throw new Error(`No checksum entry found for ${expectedPkg} in SHASUMS256.txt`);
  const expectedHash = line.split("  ")[0].trim();

  const actual = await hashFile(filePath);
  if (actual !== expectedHash) {
    rmSync(filePath);
    throw new Error(`SHA-256 mismatch for ${expectedPkg}:\n  expected: ${expectedHash}\n  actual:   ${actual}\nDownload aborted.`);
  }
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

function download(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`Invalid URL: ${url}`));
    }
    if (parsed.protocol !== "https:") {
      return reject(new Error(`Refusing non-HTTPS URL: ${url}`));
    }
    if (parsed.hostname !== ALLOWED_DOWNLOAD_HOST) {
      return reject(new Error(`Refusing download from unexpected host: ${parsed.hostname}`));
    }

    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (depth >= MAX_REDIRECTS) {
          return reject(new Error(`Too many redirects downloading ${url}`));
        }
        rmSync(dest, { force: true });
        return download(res.headers.location, dest, depth + 1).then(resolve).catch(reject);
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
