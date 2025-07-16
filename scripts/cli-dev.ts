#!/usr/bin/env node

import { program } from "commander";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

program
  .command("build-dev")
  .description("Build with static.js configuration for development (with hot reload)")
  .action(() => {
    try {
      const cachePagesPath = path.resolve(
        __dirname,
        "../helpers/cachePages.js"
      );

      const htmlConfigDev = path.resolve(__dirname, "./build-html-dev.js");
      const dest = process.cwd();
      console.log("Executing static.js dev config...");

      execSync("rimraf dist", {
        cwd: dest,
        stdio: "inherit",
      });

      execSync(`rimraf cache && node ${cachePagesPath}`, {
        cwd: dest,
        stdio: "inherit",
      });

      execSync(`vite build && tsx ${htmlConfigDev}`, {
        cwd: dest,
        stdio: "inherit",
      });

      console.log("Dev build completed successfully with hot reload");
    } catch (error) {
      console.error("Dev build failed:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);