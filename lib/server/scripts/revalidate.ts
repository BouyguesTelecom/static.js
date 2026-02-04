import { execFile } from "child_process";
import { Request, Response } from "express";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const isValidPath = (p: unknown): p is string =>
  typeof p === "string" && /^[a-zA-Z0-9\/_-]+$/.test(p);

export const revalidate = (req: Request, res: Response): void => {
  try {
    const rawPaths = req?.body?.paths;
    const paths: string[] = Array.isArray(rawPaths)
      ? rawPaths.filter(isValidPath)
      : [];

    const cachePages = path.resolve(__dirname, "../../../helpers/cachePages.js");
    const buildHtmlConfig = path.resolve(__dirname, "../../../scripts/build-html.js");

    execFile(
      "node",
      [cachePages, ...paths],
      { env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: "0" } },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Cache pages error: ${error}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        if (stderr) console.error(`stderr: ${stderr}`);

        execFile("npx", ["tsx", buildHtmlConfig], (error, stdout, stderr) => {
          if (error) {
            console.error(`Build HTML error: ${error}`);
            return;
          }
          console.log(`stdout: ${stdout}`);
          if (stderr) console.error(`stderr: ${stderr}`);
        });
      }
    );

    res
      .status(200)
      .send(
        `Revalidation triggered, paths: ${
          paths.length > 0 ? paths.join(", ") : "all pages"
        } built!`
      );
  } catch (error) {
    console.error("Revalidation error:", error);
    res.status(500).send("Error during revalidation.");
  }
};