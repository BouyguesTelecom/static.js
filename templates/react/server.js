/**
 * React template server entry point
 * Uses the @bouygues-telecom/staticjs lib package
 */

import { startStaticJSServer } from '@bouygues-telecom/staticjs';

// Start the server using the lib package implementation
const app = await startStaticJSServer();

export default app;