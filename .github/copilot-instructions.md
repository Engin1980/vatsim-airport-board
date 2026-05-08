# Copilot instructions for vatsim-airport-board

## Build, test, and lint commands
- Install deps: npm install
- Start dev server: npm run dev  (runs `vite`)
- Build (production): npm run build  (runs `tsc -b && vite build`)
- Preview build: npm run preview  (runs `vite preview`)
- Lint: npm run lint  (runs `eslint .`)

Tests: No test script or test runner is configured in package.json. If tests are added, common single-test examples:
- Vitest (example): npx vitest run path/to/file.test.ts -- -t "test name"
- Jest (example): npx jest path/to/file.test.ts -t "test name"

## High-level architecture
- Framework: React + TypeScript + Vite.
- Entry point: src/main.tsx renders <App /> into #root.
- Build step runs `tsc -b` first (package.json uses project references) then `vite build` — the repo uses composite TypeScript configs (tsconfig.app.json, tsconfig.node.json) referenced from tsconfig.json.
- App is small, assets live under src/assets; CSS under src/*.css.
- Vite config is minimal: vite.config.ts enabling the official React plugin (@vitejs/plugin-react).

## Key conventions and repo-specific notes
- Scripts: prefer using the npm scripts defined in package.json (dev/build/lint/preview) rather than invoking tooling directly; `build` runs type-checked compilation first.
- Linting: `npm run lint` runs ESLint across the repo. README suggests enabling type-aware ESLint rules by configuring parserOptions.project with tsconfig.app.json and tsconfig.node.json. If enabling those, ensure the tsc project references are valid.
- TypeScript: repo uses project references (see tsconfig.json -> tsconfig.app.json + tsconfig.node.json). Use `tsc -b` when doing full-type builds locally or in CI.
- No test runner was chosen — add tests under a consistent pattern (e.g., src/**/__tests__ or src/**/*.test.tsx) and add a `test` script to package.json to make it discoverable by Copilot.

## Assistant and AI configs checked
- Searched for common assistant config files and none were found: CLAUDE.md, AGENTS.md, CONVENTIONS.md, AIDER_CONVENTIONS.md, .cursorrules, .windsurfrules, .clinerules, .cursor/rules. If you add one, include a brief summary and the expected root commands for the repo.

---

## Project-specific data inputs
- Flights JSON: The app consumes a JSON file with the current flights board. Provide the JSON file to the assistant when ready. Recommended placement during development: src/data/flights.json. Alternatively, serve it from a local API endpoint.
- Airports list: The repository uses an airports CSV at public/data/airports.csv (served at /data/airports.csv). It should include standard identifiers (IATA/ICAO), airport name, city, and country so the app can resolve display names from flight records that reference airports by code.

Assistant note: The maintainer will supply the flights JSON later; the assistant has saved this context for subsequent tasks and will use the airports CSV to resolve airport names.

Implemented helper: a CSV parser and loader were added at src/services/airportService.ts which loads data/airports.csv at runtime and exposes loadAirports(): Promise<Map<string, Airport>> and airportsToArray(). Type definitions live at src/models/airport.ts. A UI component that lists airports by ICAO was added at src/components/AirportList/AirportList.tsx and is loaded at app startup (App.tsx calls loadAirports on mount).

Added VATSIM data loader: the app now fetches the VATSIM v3 feed from https://data.vatsim.net/v3/vatsim-data.json. A new model file src/models/vatsim.ts describes VATSIM data shapes and src/services/vatsimService.ts exposes loadVatsimData(): Promise<VatsimData> plus extractActiveFlightsPilots(). The service extracts `general.update`, `pilots` and `profiles` (handles several possible key names).

Routing and pages:
- Implemented simple hash-based routing in src/App.tsx. Home (root) shows an airport selector built from data/airports.csv. Clicking an airport navigates to #/airport/ICAO.
- Added pages:
  - src/pages/AirportSelect: lists airports and links to the board page.
  - src/pages/AirportBoard: renders two tables (arrivals and departures) for the selected ICAO. Each row shows callsign, origin/destination ICAO, and an expected time computed from the flight plan when available.

Time helpers:
- Added src/utils/flightTime.ts with tolerant parsers for departure times and enroute durations and helpers to format/compute arrival times.

Notes for future work:
- The airport map is keyed by ICAO for fast lookup; use Map.get(icao) for O(1) resolution when rendering flight rows.
- The service uses a small CSV parser that correctly handles quoted fields; if CSV size causes performance issues, consider moving parsing to a build step or server-side preprocessing.

If you want, I can also create a simple CI workflow or add a Playwright (or other) MCP server configuration to exercise the app in a browser. Would you like an MCP server configured for end-to-end testing (e.g., Playwright)?
