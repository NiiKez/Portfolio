// Stub for the `server-only` package used in tests. The real module
// throws when imported in a client/browser bundle, but for Vitest we
// just want safe-action.ts to load without complaint.
export {};
