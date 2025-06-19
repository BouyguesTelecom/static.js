import fs from 'fs';
import path from 'path';

const sourceDir = './dist';

const htmlFiles = ['page1.html', 'page2.html'];

const outputDir = 'test';
const outputFile = 'test-multi-app.html';

const readFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

const writeOutputFile = (filePath, content) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, 'utf8', (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

const createDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const generateHtmlFile = async () => {
    try {
        createDir(outputDir);

        const htmlContents = await Promise.all(
            htmlFiles.map(file => readFile(path.join(sourceDir, file)))
        );

        let combinedContent = htmlContents.join("\n<!-- Page Separator -->\n");

        combinedContent = combinedContent.replace(/src="page1.js"/g, 'src="../dist/page1.js"');
        combinedContent = combinedContent.replace(/src="page2.js"/g, 'src="../dist/page2.js"');

        await writeOutputFile(path.join(outputDir, outputFile), combinedContent);

        console.log(`Le fichier ${outputFile} a été créé avec succès dans le dossier ${outputDir}.`);
    } catch (error) {
        console.error(`Une erreur est survenue: ${error.message}`);
    }
};

generateHtmlFile();
