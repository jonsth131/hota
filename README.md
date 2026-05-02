# Hota – Hotmodelleringsverktyg

**Hota** är ett klientbaserat hotmodelleringsverktyg som körs helt i webbläsaren – ingen server, ingen inloggning, inga data som lämnar din dator.

[![Netlify Status](https://api.netlify.com/api/v1/badges/141101e6-5708-4085-807f-fc10720ab08b/deploy-status)](https://app.netlify.com/projects/hota-app/deploys)

## Funktioner

- Ritbord med SVG-baserade diagram (element, kopplingar, förtroensgränser)
- Stöd för metodologierna **STRIDE** och **PASTA**
- Importera/exportera modeller som **JSON** eller **YAML**
- Auto-sparning i `localStorage`
- Rapportgenerering direkt i webbläsaren
- HTML-sanering av all användarinmatning

## Kom igång

### Krav

- [Node.js](https://nodejs.org/) ≥ 22
- npm ≥ 9

### Installation

```bash
git clone https://github.com/jonsth131/hota.git
cd hota
npm install
```

### Utvecklingsserver

```bash
npm run dev
```

Öppna sedan [http://localhost:5173](http://localhost:5173) i webbläsaren.

### Produktion

```bash
npm run build        # Bygger till dist/
npm run preview      # Förhandsgranskar produktionsbygget lokalt
```

## Tillgängliga kommandon

| Kommando            | Beskrivning                          |
|---------------------|--------------------------------------|
| `npm run dev`       | Startar Vite dev-server              |
| `npm run build`     | Produktionsbygge                     |
| `npm run preview`   | Förhandsgranska bygget lokalt        |
| `npm run typecheck` | Typkontroll utan kompilering         |
| `npm run lint`      | ESLint på `src/`                     |
| `npm run format`    | Prettier på `src/`                   |
| `npm run test`      | Kör alla tester (en gång)            |
| `npm run test:watch`| Kör tester i bevakningsläge          |

## Arkitektur

```
src/
  types.ts            ← Alla domäntyper (Model, DiagramElement, Connection, Threat, …)
  main.ts             ← Startpunkt; kopplar ihop moduler och registrerar händelsehanterare
  store/
    model.ts          ← Central muterbar state + typad händelsesändare (on / emit)
    persistence.ts    ← Auto-sparning med debounce; injicerbar lagringsbakände
  diagram/            ← SVG-rendering (canvas, element, kopplingar, interaktion, resize, gränser)
  ui/                 ← Verktygsfält, sidopanel, egenskapspanel, modaler, rapport
  io/                 ← JSON- och YAML-import/export med validering
  methodology/        ← STRIDE- och PASTA-kategorier och mallar
  utils/              ← ID-generering, HTML-sanering
```

**Dataflöde**: mutationer går genom `store/model.ts` → `emit()` → `main.ts`-lyssnare ritar om SVG:n. Moduler muterar aldrig state direkt.

## Teknisk stack

| Del          | Teknik                        |
|--------------|-------------------------------|
| Språk        | TypeScript                    |
| Bundler      | Vite                          |
| Styling      | Tailwind CSS v4               |
| Testramverk  | Vitest                        |
| Linting      | ESLint + typescript-eslint    |
| Formatering  | Prettier                      |

## Tester

Tester finns under `src/__tests__/`. Kör alla tester:

```bash
npm run test
```

Kör ett enskilt testfil:

```bash
npx vitest run src/__tests__/model.test.ts
```

## Licens

[MIT](LICENSE)
