import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "frontend", "dist", "levis-progress-frontend", "browser");
const target = path.join(root, "backend", "public");

if (!fs.existsSync(source)) {
  throw new Error(`Frontend build output not found: ${source}`);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(source, target, { recursive: true });

console.log(`Copied frontend build to ${target}`);
