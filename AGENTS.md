# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Atlas is a vanilla TypeScript + Vite intelligence dashboard (no React/frameworks). See `CLAUDE.md` for full architecture, `README.md` for quick-start commands, and `docs/` for edge function patterns.

### Running services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Vite dev server | `npm run dev` | 3000 | Only required service; serves the SPA with HMR |

No databases, Docker, or external services are needed for local development. All API keys in `.env.example` are optional — the cache system falls back to memory-only when Redis is unconfigured.

### Testing

- **Edge function tests**: `npx tsx scripts/test-edge-functions.js` (23 tests). The `npm test` command as-is uses bare `node` which fails on extensionless `.ts` imports; use `npx tsx` instead.
- **Type checking**: `npm run typecheck`
- **Build check**: `npm run build` (runs `tsc && vite build`)

### Gotchas

- The test script (`scripts/test-edge-functions.js`) imports `.ts` files with extensionless specifiers (e.g., `from './_cors'`). Node.js ESM cannot resolve these natively. Use `npx tsx` to run tests instead of bare `node`.
- No ESLint config file (e.g., `eslint.config.js`) exists yet despite `eslint` being in devDependencies. There is no `lint` script in `package.json`.
- The Vite config sets `root: './src'`, so `index.html` lives at `src/index.html`, not the repo root.
