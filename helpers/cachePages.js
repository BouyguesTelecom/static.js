import fs from "fs";
import path from "path";
import { readPages } from "./readPages.js";

const pagesDir = path.resolve(process.cwd(), "src/pages");
const args = process.argv.slice(2);
const cacheDir = path.resolve(process.cwd(), "cache");
const cacheFilePath = path.resolve(cacheDir, "pagesCache.json");

let entries;

if (args.length > 0) {
  entries = args
    .filter((arg) => arg.endsWith(".tsx"))
    .reduce((obj, tsxFile) => {
      console.log(`Processing arg: ${tsxFile}`);
      const relativePathWithoutExtension = tsxFile.replace(/\.tsx$/, "");
      const fullPath = path.resolve(pagesDir, tsxFile);
      obj[relativePathWithoutExtension] = fullPath;
      return obj;
    }, {});
} else {
  entries = readPages(pagesDir);
}

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
fs.writeFileSync(cacheFilePath, JSON.stringify(entries, null, 2), "utf8");
console.log("Pages cached successfully.");
