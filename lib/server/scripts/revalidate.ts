import { exec } from "child_process";
import { Request, Response } from "express";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const revalidate = (req: Request, res: Response): void => {
  try {
    const paths = req?.body?.paths || [];
    const pathsArg = paths.length > 0 ? paths.join(" ") : "";
    const cachePages = path.resolve(__dirname, "../../../helpers/cachePages.js");
    const buildHtmlConfig = path.resolve(__dirname, "../../../scripts/build-html.js");

    const buildCommand = `NODE_TLS_REJECT_UNAUTHORIZED=0 node ${cachePages} ${
      pathsArg && `${pathsArg}`
    } && npx tsx ${buildHtmlConfig}`;

    exec(buildCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error}`);
        return;
      }
      if (!error) {
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
      }
    });

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