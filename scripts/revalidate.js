import express from 'express';
import { exec } from 'child_process';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const rebuildApplication = (paths) => {
    console.log('Rebuilding application...');

    console.log(`Building paths: ${paths}`);

    const pathsArg = paths.length > 0 ? paths.join(' ') : '';

    const buildCommand = `NODE_TLS_REJECT_UNAUTHORIZED=0 node helpers/cachePages.js ${pathsArg && `-- ${pathsArg}`} && tsx build-html.js`;

    exec(buildCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
};

app.post('/revalidate', (req, res) => {
    try {
        const paths = req?.body?.paths || [];
        rebuildApplication(paths);
        res.status(200).send(`Revalidation triggered, paths: ${paths.length > 0 ? paths.join(', ') : 'all pages'} built!`);
    } catch (error) {
        console.error('Revalidation error:', error);
        res.status(500).send('Error during revalidation.');
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
