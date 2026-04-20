# Hota – Copilot Instructions

Hota is a client-side threat-modeling tool built with TypeScript, Vite, and Tailwind CSS v4. The UI language is **Swedish** — all labels, error messages, and user-facing strings must remain in Swedish.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build
npm run typecheck    # tsc --noEmit (no emit)
npm run lint         # ESLint (src/)
npm run format       # Prettier (src/)
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)

# Run a single test file
npx vitest run src/__tests__/model.test.ts
```

## Architecture

The app is split into four layers that communicate via a typed event bus:

```
src/
  types.ts            ← All domain types (Model, DiagramElement, Connection, Threat, …)
  main.ts             ← Entry point; wires all modules together, registers event handlers
  store/
    model.ts          ← Central mutable state + typed event emitter (on / emit)
    persistence.ts    ← Debounced localStorage auto-save; injectable storage backend
  diagram/            ← SVG rendering (canvas, elements, connections, interaction, resize, boundary)
  ui/                 ← Toolbar, sidebar, properties panel, modals, report
  io/                 ← JSON and YAML import/export with validation
  methodology/        ← STRIDE and PASTA category/template definitions
  utils/              ← ID generation, HTML sanitization
```

**Data flow**: mutations go through `store/model.ts` functions → `emit()` events → `main.ts` listeners re-render the SVG. Modules never mutate state directly.

## Key Conventions

### Event-driven state
All state changes must go through the store's mutation functions (`addElement`, `updateElement`, `removeElement`, etc.). These emit typed events defined in `EventMap` (`types.ts`). Subscribers use `on(event, fn)` which returns an unsubscribe function.

### Import paths use `.js` extension
TypeScript source files import each other with `.js` extensions (ESM/Vite convention):
```ts
import { generateId } from '../utils/id.js';
```

### ID format
Use `generateId(prefix)` from `utils/id.ts` — produces `${prefix}-${Date.now().toString(36)}-${counter}` (e.g. `el-abc123-1`).

### TrustBoundary shape
`TrustBoundary` elements store their geometry as `metadata.points: Array<{x, y}>` (absolute world-coordinate polyline points), not via `x/y/w/h`. The `x/y` fields on the element hold the first point's position.

### Persistence storage is injectable
`initPersistence(storage?)` and `loadFromStorage(storage?)` accept an optional storage backend so tests can pass a mock instead of touching `localStorage`.

### Cascade deletes
`removeElement` automatically removes all connections and threats that reference the deleted element. Don't manually clean those up from call sites.

### Import/export result type
IO functions return a discriminated union `{ ok: true; model: Model } | { ok: false; error: string }` — always check `result.ok` before using `result.model`.

## Testing

Tests live in `src/__tests__/`. Test files import store functions directly; no DOM setup is needed for pure logic tests. Always call `resetModel()` in `beforeEach` when testing model state to ensure isolation.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { addElement, resetModel } from '../store/model.js';

beforeEach(() => resetModel());
```

## Formatting

Prettier config (`.prettierrc`): single quotes, semicolons, `printWidth: 100`, `trailingComma: "es5"`.
