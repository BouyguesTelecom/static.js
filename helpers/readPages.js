import fs from "fs";
import path from "path";

export function readPages(dir, baseDir = dir) {
  let result = {};
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const nested = readPages(fullPath, baseDir);
      result = { ...result, ...nested };
    } else if (file.endsWith(".tsx")) {
      const relPath = path.relative(baseDir, fullPath).replace(/\.tsx$/, "");
      result[relPath] = fullPath;
    }
  }

  return result;
}
