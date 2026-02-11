#!/usr/bin/env node

import { Spinner } from "cli-spinner";
import { downloadTemplate } from "giget";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function createReactPowerStatic(projectName: string) {
    const dest = path.join(process.cwd(), projectName);
    const spinner = new Spinner("Creating react project... %s");
    spinner.setSpinnerString("|/-\\");
    spinner.start();

    try {
        await downloadTemplate(`github:BouyguesTelecom/static.js/templates/react#main`, {
            force: true,
            offline: false,
            provider: "github",
            cwd: dest,
            dir: `.`,
        });

        spinner.stop(true);
        console.log("React project created successfully in " + dest);
    } catch (error) {
        spinner.stop(true);
        console.error("Error can't create react project:", error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

rl.question("🚀 Enter the name for your new project: ", (projectName) => {
    createReactPowerStatic(projectName);
});
