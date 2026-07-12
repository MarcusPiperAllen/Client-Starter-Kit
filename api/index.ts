// Vercel serverless entry point for the Express API.
//
// Root Directory for this Vercel project is the repo root, so Vercel's
// zero-config Node builder picks up any file under /api automatically.
// The `rewrites` rule in vercel.json sends every /api/* request here while
// preserving the original request path, so Express's own "/api" mount
// (see artifacts/api-server/src/app.ts) still matches correctly.
export { default } from "../artifacts/api-server/src/app";
