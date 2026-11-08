# Graph Report - budgeter-web  (2026-11-08)

## Corpus Check
- 50 files · ~49,179 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .ttf 4, (none) 3)

## Summary
- 678 nodes · 2883 edges · 16 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `151a15fa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- state.ts
- BudgetScreen.tsx
- store.ts
- ai.ts
- TripScreen.tsx
- ExpenseScreen.tsx
- records.ts
- Budgeter Web
- sheets.ts
- package.json
- expo
- ExpenseScreen.tsx
- records.test.ts
- AGENTS.md
- tsconfig.json
- MonthBar.tsx

## God Nodes (most connected - your core abstractions)
1. `Small()` - 61 edges
2. `ExpenseScreen()` - 55 edges
3. `PixelButton()` - 52 edges
4. `HomeScreen()` - 41 edges
5. `todayIso()` - 40 edges
6. `money()` - 40 edges
7. `Body()` - 39 edges
8. `useAppState()` - 38 edges
9. `BudgetScreen()` - 38 edges
10. `currency()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `resume()`  [EXTRACTED]
  App.tsx → src/date/client.ts
- `Root()` --calls--> `ScannerProvider()`  [EXTRACTED]
  App.tsx → src/ocr/scanner.tsx
- `screen()` --calls--> `BudgetScreen()`  [EXTRACTED]
  App.tsx → src/screens/BudgetScreen.tsx
- `screen()` --calls--> `ExpenseScreen()`  [EXTRACTED]
  App.tsx → src/screens/ExpenseScreen.tsx
- `screen()` --calls--> `MacrosScreen()`  [EXTRACTED]
  App.tsx → src/screens/MacrosScreen.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared date budget on Firebase** — readme_date_budget, readme_firebase_project, readme_datebudget_site, readme_firebase_api_key [EXTRACTED 0.90]
- **Cross-device sync of Budgeter data** — readme_google_sheets_sync, readme_sync_tab, readme_records_sync_format, readme_last_change_wins [EXTRACTED 0.90]

## Communities (16 total, 0 thin omitted)

### Community 0 - "state.ts"
Cohesion: 0.08
Nodes (22): DEFAULT_TRACKED, Bank, DEFAULT_MONTHLY, FoodPreset, Foreign, Line, LINE_KINDS, LineKind (+14 more)

### Community 1 - "BudgetScreen.tsx"
Cohesion: 0.06
Nodes (101): addDays(), clamp(), Day, daysBetween(), daySpend, epochDay(), fromEpochDay(), isoDate() (+93 more)

### Community 2 - "store.ts"
Cohesion: 0.13
Nodes (7): changeHooks, listeners, load(), state, mem, tabs, writes

### Community 3 - "ai.ts"
Cohesion: 0.07
Nodes (61): Ai, chat(), http(), keyOf(), models(), PRESETS, Provider, safeBase() (+53 more)

### Community 4 - "TripScreen.tsx"
Cohesion: 0.07
Nodes (118): App(), BottomBar(), renewOnTap(), Root(), screen(), ScanningOverlay(), SideBar(), TABS (+110 more)

### Community 5 - "ExpenseScreen.tsx"
Cohesion: 0.08
Nodes (70): inPeriod(), todayIso(), dateContributions(), addTx(), api(), Budget, create(), dateState (+62 more)

### Community 6 - "records.ts"
Cohesion: 0.25
Nodes (20): state(), txn(), Categories, mergeRemote(), withRecord(), newId(), normMacros(), normMeal() (+12 more)

### Community 7 - "Budgeter Web"
Cohesion: 0.07
Nodes (23): EAS build, submit, update, Expo dev commands (install, lint, tsc, doctor), Expo / React Native mobile app guidance, Expo Router navigation (src/app), Budgeter Android app, Budgeter Web, Data, Date budget (+15 more)

### Community 8 - "sheets.ts"
Cohesion: 0.21
Nodes (19): personLabel(), addTab(), append(), batchUpdate(), col(), createSpreadsheet(), existingTabs(), findSpreadsheet() (+11 more)

### Community 9 - "package.json"
Cohesion: 0.07
Nodes (36): dependencies, expo@~57.0.28, expo-font@~57.0.4, @expo/metro-runtime@~57.0.16, expo-status-bar@~57.0.1, react@19.2.3, react-dom@19.2.3, react-native@0.86.3 (+28 more)

### Community 10 - "expo"
Cohesion: 0.08
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+17 more)

### Community 11 - "ExpenseScreen.tsx"
Cohesion: 0.07
Nodes (72): parse(), validDate(), allocate(), convert(), decimal(), digits, div(), money() (+64 more)

### Community 12 - "records.test.ts"
Cohesion: 0.28
Nodes (7): canon(), encodeRecord(), recordObjects(), Remote, stampedSince(), setup, toUpload()

### Community 16 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 18 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

### Community 19 - "MonthBar.tsx"
Cohesion: 0.24
Nodes (14): DEFAULT_CATEGORIES, alertColor(), barTotal(), CategoryColors, freeAndTarget(), MONTH_BLOCKS, MonthBar(), monthBlocks() (+6 more)

## Knowledge Gaps
- **8 isolated node(s):** `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)`, `DateBudget site`, `EXPO_PUBLIC_FIREBASE_API_KEY (.env.local)` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 136 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `package.json` to `BudgetScreen.tsx`, `store.ts`, `ai.ts`, `TripScreen.tsx`, `ExpenseScreen.tsx`, `ExpenseScreen.tsx`, `MonthBar.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `state.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `TripScreen.tsx` to `BudgetScreen.tsx`, `ai.ts`, `ExpenseScreen.tsx`, `package.json`, `ExpenseScreen.tsx`, `MonthBar.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `BudgetScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06368985808238145 - nodes in this community are weakly interconnected._
- **Why does `Small()` connect `ExpenseScreen.tsx` to `BudgetScreen.tsx`, `ai.ts`, `TripScreen.tsx`, `ExpenseScreen.tsx`, `MonthBar.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `store.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._