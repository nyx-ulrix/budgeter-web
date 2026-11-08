# Graph Report - budgeter-web  (2026-11-08)

## Corpus Check
- 50 files · ~48,660 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .ttf 4, (none) 3)

## Summary
- 675 nodes · 2853 edges · 18 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f5ae29e8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- BudgetScreen.tsx
- scanner.tsx
- ai.ts
- TripScreen.tsx
- ExpenseScreen.tsx
- state.ts
- Budgeter Web
- sheets.ts
- package.json
- expo
- core.test.ts
- nav.tsx
- devDependencies
- scripts
- AGENTS.md
- tsconfig.json
- HomeScreen.tsx

## God Nodes (most connected - your core abstractions)
1. `Small()` - 60 edges
2. `ExpenseScreen()` - 55 edges
3. `PixelButton()` - 51 edges
4. `HomeScreen()` - 41 edges
5. `todayIso()` - 39 edges
6. `money()` - 39 edges
7. `Body()` - 39 edges
8. `BudgetScreen()` - 38 edges
9. `currency()` - 36 edges
10. `useAppState()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `startSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
- `renewOnTap()` --calls--> `requestToken()`  [EXTRACTED]
  App.tsx → src/sync/google.ts
- `renewOnTap()` --calls--> `queueSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
- `Root()` --calls--> `useAppState()`  [EXTRACTED]
  App.tsx → src/data/store.ts
- `Root()` --calls--> `ScannerProvider()`  [EXTRACTED]
  App.tsx → src/ocr/scanner.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared date budget on Firebase** — readme_date_budget, readme_firebase_project, readme_datebudget_site, readme_firebase_api_key [EXTRACTED 0.90]
- **Cross-device sync of Budgeter data** — readme_google_sheets_sync, readme_sync_tab, readme_records_sync_format, readme_last_change_wins [EXTRACTED 0.90]

## Communities (18 total, 0 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.17
Nodes (19): App(), BottomBar(), renewOnTap(), Root(), ScanningOverlay(), SideBar(), TABS, Toolbar() (+11 more)

### Community 1 - "BudgetScreen.tsx"
Cohesion: 0.07
Nodes (91): addDays(), clamp(), Day, daysBetween(), daySpend, epochDay(), fromEpochDay(), isoDate() (+83 more)

### Community 2 - "scanner.tsx"
Cohesion: 0.33
Nodes (8): parse(), activeTrip(), Ctx, ocr(), photo(), Scanner, ScannerProvider(), read()

### Community 3 - "ai.ts"
Cohesion: 0.07
Nodes (57): Ai, chat(), http(), keyOf(), models(), PRESETS, Provider, safeBase() (+49 more)

### Community 4 - "TripScreen.tsx"
Cohesion: 0.08
Nodes (97): screen(), preset, div(), addTrip(), deleteTripCost(), payTripCost(), saveTrip(), saveTripCost() (+89 more)

### Community 5 - "ExpenseScreen.tsx"
Cohesion: 0.06
Nodes (90): inPeriod(), todayIso(), receiptDate(), itemShares(), require(), split(), SPLIT_LABEL, SPLIT_METHODS (+82 more)

### Community 6 - "state.ts"
Cohesion: 0.06
Nodes (53): DEFAULT_TRACKED, state(), txn(), canon(), Categories, encodeRecord(), mergeRemote(), recordObjects() (+45 more)

### Community 7 - "Budgeter Web"
Cohesion: 0.07
Nodes (23): EAS build, submit, update, Expo dev commands (install, lint, tsc, doctor), Expo / React Native mobile app guidance, Expo Router navigation (src/app), Budgeter Android app, Budgeter Web, Data, Date budget (+15 more)

### Community 8 - "sheets.ts"
Cohesion: 0.17
Nodes (24): personLabel(), now(), addTab(), append(), batchUpdate(), col(), createSpreadsheet(), existingTabs() (+16 more)

### Community 9 - "package.json"
Cohesion: 0.13
Nodes (21): dependencies, expo@~57.0.28, expo-font@~57.0.4, @expo/metro-runtime@~57.0.16, expo-status-bar@~57.0.1, react-dom@19.2.3, react-native@0.86.3, react-native-web@^0.21.2 (+13 more)

### Community 10 - "expo"
Cohesion: 0.08
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+17 more)

### Community 11 - "core.test.ts"
Cohesion: 0.15
Nodes (21): validDate(), digits, charges(), computedTotal(), itemCosts(), mismatch(), parsedReceipt, receiptItem (+13 more)

### Community 12 - "nav.tsx"
Cohesion: 0.29
Nodes (6): react@19.2.3, react, Ctx, Nav, Screen, Tab

### Community 13 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, tsx@^4.23.15, @types/react@~19.2.2, typescript@~6.0.3, tsx, @types/react, typescript

### Community 14 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, android, build:web, ios, start, test, web

### Community 16 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 18 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

### Community 19 - "HomeScreen.tsx"
Cohesion: 0.12
Nodes (43): allocate(), convert(), decimal(), money(), parseMoney(), plain(), roundHalfUp(), symbol() (+35 more)

## Knowledge Gaps
- **8 isolated node(s):** `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)`, `DateBudget site`, `EXPO_PUBLIC_FIREBASE_API_KEY (.env.local)` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 136 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `nav.tsx` to `App.tsx`, `BudgetScreen.tsx`, `scanner.tsx`, `ai.ts`, `TripScreen.tsx`, `ExpenseScreen.tsx`, `state.ts`, `package.json`, `HomeScreen.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BudgetScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06958762886597938 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `package.json` to `App.tsx`, `BudgetScreen.tsx`, `ai.ts`, `TripScreen.tsx`, `ExpenseScreen.tsx`, `HomeScreen.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `ai.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07010402532790593 - nodes in this community are weakly interconnected._
- **Why does `Small()` connect `TripScreen.tsx` to `App.tsx`, `BudgetScreen.tsx`, `ai.ts`, `ExpenseScreen.tsx`, `HomeScreen.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `TripScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08445642407906559 - nodes in this community are weakly interconnected._