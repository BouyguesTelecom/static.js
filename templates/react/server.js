/**
 * React template server entry point
 * Uses the root @static-js/server instead of local server implementation
 */

import { startStaticJSServer } from '@static-js/server';

// Start the server using the root server implementation
const app = await startStaticJSServer();

export default app;