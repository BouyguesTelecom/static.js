import type {TestProject} from "vitest/node";
import {buildApp, installFixtureApp, packLib} from "./app.js";

declare module "vitest" {
    export interface ProvidedContext {
        tarball: string;
        basicAppDir: string;
    }
}

/**
 * Packs the library and installs + builds the fixture app once for all
 * integration test files. Tests that need to mutate the app clone it first.
 */
export default async function setup(project: TestProject) {
    const tarball = await packLib();
    const basicAppDir = await installFixtureApp({tarball, name: "basic-app"});
    await buildApp(basicAppDir);
    project.provide("tarball", tarball);
    project.provide("basicAppDir", basicAppDir);
}
