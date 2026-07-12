// Imports the pre-bundled Express app (built by artifacts/api-server/build.mjs)
// rather than the raw TypeScript source, so Vercel's function bundler doesn't
// need to type-check/resolve the api-server package's own module graph —
// esbuild has already fully resolved and inlined it into one plain JS file.
// @ts-expect-error -- no type declarations are emitted for the bundled output
import app from "../artifacts/api-server/dist/app.mjs";

export default app;
