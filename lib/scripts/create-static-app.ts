#!/usr/bin/env node

import {program} from "commander";
import {execSync} from "node:child_process";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
program
    .command("build")
    .description("Build with static.js configuration")
    .action(() => {
        try {
            const cachePagesPath = path.resolve(
                __dirname,
                "../helpers/cachePages.js"
            );

            const htmlConfig = path.resolve(__dirname, "./build-html.js");
            const dest = process.cwd();
            console.log("Executing static.js config...");

            execSync("rimraf dist", {
                cwd: dest,
                stdio: "inherit",
            });

            execSync(`rimraf cache && node ${cachePagesPath}`, {
                cwd: dest,
                stdio: "inherit",
            });

            execSync(`vite build && tsx ${htmlConfig}`, {
                cwd: dest,
                stdio: "inherit",
            });

            console.log("Build completed successfully");
        } catch (error) {
            console.error("Build failed:", error);
            process.exit(1);
        }
    });

program.parse(process.argv);
