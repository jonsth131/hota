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
All state changes must go through the store's mutation functions (`addElement`, `updateElement`, `removeElement`, etc.). These emit typed events defined in `EventMap` (`types.ts`). Subscribers use `on(event, handler)` — never mutate state directly from UI code.

### Import paths use `.js` extension
TypeScript source files import each other with `.js` extensions (ESM/Vite convention):
```ts
import { generateId } from '../utils/id.js';
```

### ID format
Use `generateId(prefix)` from `utils/id.ts` — produces `${prefix}-${Date.now().toString(36)}-${counter}` (e.g. `el-abc123-1`).

### TrustBoundary shape
`TrustBoundary` elements store their geometry as `metadata.points: Array<{x, y}>` (absolute world-coordinate polyline points), not via `x/y/w/h`. The `x/y` fields on the element hold the first point as a convenience.

### Persistence storage is injectable
`initPersistence(storage?)` and `loadFromStorage(storage?)` accept an optional storage backend so tests can pass a mock instead of touching `localStorage`.

### Cascade deletes
`removeElement` automatically removes all connections and threats that reference the deleted element. Don't manually clean those up from call sites.

### Import/export result type
IO functions return a discriminated union `{ ok: true; model: Model } | { ok: false; error: string }` — always check `result.ok` before using `result.model`.

## Testing

Tests live in `src/__tests__/`. Test files import store functions directly; no DOM setup is needed for pure logic tests. Always call `resetModel()` in `beforeEach` when testing model state to ensure isolation between tests.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { addElement, resetModel } from '../store/model.js';

beforeEach(() => resetModel());
```

**Every new feature or bug fix must be accompanied by tests.** Aim for coverage of all public store functions, IO paths, and utility functions. UI modules (diagram/, ui/) do not require DOM tests unless logic is non-trivial.

## Security

- All user-supplied strings rendered into the DOM must be sanitized using `sanitizeHtml()` from `utils/sanitize.ts`. Never use `innerHTML` with raw user input.
- IO import functions validate the structure of incoming JSON/YAML before applying it to the model — always use the existing validation layer and extend it if new fields are added.
- The app is fully client-side; no data is ever sent to a server. Keep it that way — do not introduce network requests or external data fetching.

## Performance

- SVG re-renders are triggered by store events. Avoid triggering multiple redundant emits in a single user action — batch mutations where possible.
- `persistence.ts` uses debounced writes to `localStorage`. Do not call `saveToStorage()` directly from hot paths.
- Avoid heavy computation in event handlers. If a calculation is expensive, memoize or move it out of the render cycle.

## Maintainability

- Keep modules single-responsibility. `diagram/` renders, `store/` manages state, `ui/` handles user interaction — don't blur these boundaries.
- Prefer small, pure functions that are easy to unit test over large imperative blocks.
- Exported types live in `types.ts` — don't scatter type definitions across modules.
- When adding a new diagram element type or methodology, follow the existing pattern in `methodology/` and extend `types.ts` accordingly.

## Documentation

- **Keep `README.md` up to date** when adding new features, commands, or dependencies.
- **Keep this file (`copilot-instructions.md`) up to date** when architecture, conventions, or tooling change.
- New non-obvious conventions or patterns should be documented here with a short explanation and example.

## Formatting

Prettier config (`.prettierrc`): single quotes, semicolons, `printWidth: 100`, `trailingComma: "es5"`.