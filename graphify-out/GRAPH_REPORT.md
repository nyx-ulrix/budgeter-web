# Graph Report - budgeter-web  (2026-11-01)

## Corpus Check
- 50 files · ~47,667 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .ttf 4, (none) 3)

## Summary
- 670 nodes · 2817 edges · 13 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a109174`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ExpenseScreen.tsx
- BudgetScreen.tsx
- DateScreen.tsx
- ai.ts
- HomeScreen.tsx
- core.test.ts
- state.ts
- Budgeter Web
- sheets.ts
- package.json
- expo
- AGENTS.md
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `Small()` - 60 edges
2. `ExpenseScreen()` - 55 edges
3. `PixelButton()` - 51 edges
4. `HomeScreen()` - 41 edges
5. `money()` - 39 edges
6. `Body()` - 39 edges
7. `BudgetScreen()` - 38 edges
8. `todayIso()` - 36 edges
9. `currency()` - 36 edges
10. `useAppState()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `resume()`  [EXTRACTED]
  App.tsx → src/date/client.ts
- `App()` --calls--> `startSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
- `renewOnTap()` --calls--> `currentToken()`  [EXTRACTED]
  App.tsx → src/sync/google.ts
- `renewOnTap()` --calls--> `queueSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
- `Root()` --calls--> `useAppState()`  [EXTRACTED]
  App.tsx → src/data/store.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared date budget on Firebase** — readme_date_budget, readme_firebase_project, readme_datebudget_site, readme_firebase_api_key [EXTRACTED 0.90]
- **Cross-device sync of Budgeter data** — readme_google_sheets_sync, readme_sync_tab, readme_records_sync_format, readme_last_change_wins [EXTRACTED 0.90]

## Communities (13 total, 0 thin omitted)

### Community 0 - "ExpenseScreen.tsx"
Cohesion: 0.06
Nodes (89): App(), BottomBar(), renewOnTap(), Root(), screen(), ScanningOverlay(), SideBar(), TABS (+81 more)

### Community 1 - "BudgetScreen.tsx"
Cohesion: 0.08
Nodes (62): addDays(), clamp(), Day, daysBetween(), daySpend, epochDay(), fromEpochDay(), isoDate() (+54 more)

### Community 2 - "DateScreen.tsx"
Cohesion: 0.08
Nodes (60): react, db(), key(), Secrets, inPeriod(), todayIso(), addTx(), api() (+52 more)

### Community 3 - "ai.ts"
Cohesion: 0.09
Nodes (57): Provider, aiMacros(), FoodHit, GRAMS, gramsOf(), jsonIn(), lookupFood(), macrosIn() (+49 more)

### Community 4 - "HomeScreen.tsx"
Cohesion: 0.10
Nodes (73): prevPeriod(), money(), parseMoney(), plain(), togglePaidBack(), currency(), dailyImpact(), liveTxns() (+65 more)

### Community 5 - "core.test.ts"
Cohesion: 0.06
Nodes (71): tesseract.js@^7.0.0, tesseract.js, chat(), http(), keyOf(), models(), parse(), PRESETS (+63 more)

### Community 6 - "state.ts"
Cohesion: 0.06
Nodes (71): addLine(), buyNow(), chargeOverspend(), DateRef, deletePlanned(), deleteTrip(), deleteTxn(), dropOverspends() (+63 more)

### Community 7 - "Budgeter Web"
Cohesion: 0.07
Nodes (23): EAS build, submit, update, Expo dev commands (install, lint, tsc, doctor), Expo / React Native mobile app guidance, Expo Router navigation (src/app), Budgeter Android app, Budgeter Web, Data, Date budget (+15 more)

### Community 8 - "sheets.ts"
Cohesion: 0.18
Nodes (23): now(), currentToken(), addTab(), append(), batchUpdate(), col(), createSpreadsheet(), existingTabs() (+15 more)

### Community 9 - "package.json"
Cohesion: 0.07
Nodes (33): dependencies, expo@~57.0.28, expo-font@~57.0.4, @expo/metro-runtime@~57.0.16, expo-status-bar@~57.0.1, react@19.2.3, react-dom@19.2.3, react-native@0.86.3 (+25 more)

### Community 10 - "expo"
Cohesion: 0.08
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+17 more)

### Community 16 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 18 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

## Knowledge Gaps
- **8 isolated node(s):** `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)`, `DateBudget site`, `EXPO_PUBLIC_FIREBASE_API_KEY (.env.local)` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 136 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `DateScreen.tsx` to `ExpenseScreen.tsx`, `BudgetScreen.tsx`, `ai.ts`, `HomeScreen.tsx`, `core.test.ts`, `state.ts`, `package.json`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ExpenseScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.062424242424242424 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `ExpenseScreen.tsx` to `BudgetScreen.tsx`, `DateScreen.tsx`, `ai.ts`, `HomeScreen.tsx`, `core.test.ts`, `package.json`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `BudgetScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08344988344988345 - nodes in this community are weakly interconnected._
- **Why does `Small()` connect `ai.ts` to `ExpenseScreen.tsx`, `BudgetScreen.tsx`, `DateScreen.tsx`, `HomeScreen.tsx`, `core.test.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `DateScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07552447552447553 - nodes in this community are weakly interconnected._