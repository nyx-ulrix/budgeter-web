# Graph Report - budgeter-web  (2026-11-08)

## Corpus Check
- 50 files · ~48,069 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .ttf 4, (none) 3)

## Summary
- 673 nodes · 2843 edges · 20 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b6d045fb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ExpenseScreen.tsx
- BudgetScreen.tsx
- client.ts
- ai.ts
- HomeScreen.tsx
- ExpenseScreen.tsx
- records.ts
- Budgeter Web
- sheets.ts
- package.json
- expo
- core.test.ts
- DateScreen.tsx
- actions.ts
- store.ts
- state.ts
- AGENTS.md
- newId
- tsconfig.json
- core/money.ts

## God Nodes (most connected - your core abstractions)
1. `Small()` - 60 edges
2. `ExpenseScreen()` - 55 edges
3. `PixelButton()` - 51 edges
4. `HomeScreen()` - 41 edges
5. `money()` - 39 edges
6. `Body()` - 39 edges
7. `BudgetScreen()` - 38 edges
8. `todayIso()` - 37 edges
9. `currency()` - 36 edges
10. `useAppState()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `resume()`  [EXTRACTED]
  App.tsx → src/date/client.ts
- `App()` --calls--> `startSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
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

## Communities (20 total, 0 thin omitted)

### Community 0 - "ExpenseScreen.tsx"
Cohesion: 0.07
Nodes (62): App(), BottomBar(), renewOnTap(), Root(), ScanningOverlay(), SideBar(), TABS, react-native (+54 more)

### Community 1 - "BudgetScreen.tsx"
Cohesion: 0.09
Nodes (63): addDays(), clamp(), Day, daysBetween(), daySpend, epochDay(), fromEpochDay(), makeDay() (+55 more)

### Community 2 - "client.ts"
Cohesion: 0.17
Nodes (26): addTx(), api(), Budget, create(), dec(), decFields(), enc(), fields() (+18 more)

### Community 3 - "ai.ts"
Cohesion: 0.07
Nodes (60): Ai, chat(), http(), keyOf(), models(), preset, PRESETS, Provider (+52 more)

### Community 4 - "HomeScreen.tsx"
Cohesion: 0.09
Nodes (110): screen(), Toolbar(), money(), parseMoney(), plain(), setReserved, togglePaidBack(), currency() (+102 more)

### Community 5 - "ExpenseScreen.tsx"
Cohesion: 0.15
Nodes (27): allocate(), receiptDate(), itemShares(), require(), split(), SPLIT_LABEL, SPLIT_METHODS, SplitMethod (+19 more)

### Community 6 - "records.ts"
Cohesion: 0.24
Nodes (18): state(), canon(), Categories, encodeRecord(), mergeRemote(), recordObjects(), Remote, stampedSince() (+10 more)

### Community 7 - "Budgeter Web"
Cohesion: 0.07
Nodes (23): EAS build, submit, update, Expo dev commands (install, lint, tsc, doctor), Expo / React Native mobile app guidance, Expo Router navigation (src/app), Budgeter Android app, Budgeter Web, Data, Date budget (+15 more)

### Community 8 - "sheets.ts"
Cohesion: 0.18
Nodes (23): now(), addTab(), append(), batchUpdate(), col(), createSpreadsheet(), existingTabs(), findSpreadsheet() (+15 more)

### Community 9 - "package.json"
Cohesion: 0.06
Nodes (43): dependencies, expo@~57.0.28, expo-font@~57.0.4, @expo/metro-runtime@~57.0.16, expo-status-bar@~57.0.1, react@19.2.3, react-dom@19.2.3, react-native@0.86.3 (+35 more)

### Community 10 - "expo"
Cohesion: 0.08
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+17 more)

### Community 11 - "core.test.ts"
Cohesion: 0.15
Nodes (22): isoDate(), validDate(), digits, charges(), computedTotal(), itemCosts(), mismatch(), parsedReceipt (+14 more)

### Community 12 - "DateScreen.tsx"
Cohesion: 0.15
Nodes (24): react, inPeriod(), dateState, Draft, addDays(), advance(), budgetRows(), creditDate() (+16 more)

### Community 13 - "actions.ts"
Cohesion: 0.13
Nodes (22): todayIso(), addLine(), DateRef, deletePlanned(), deleteTrip(), deleteTripCost(), editPlan(), isSpentReserve() (+14 more)

### Community 14 - "store.ts"
Cohesion: 0.12
Nodes (8): AppState, changeHooks, listeners, load(), state, mem, tabs, writes

### Community 15 - "state.ts"
Cohesion: 0.12
Nodes (15): DEFAULT_TRACKED, Bank, DEFAULT_CATEGORIES, DEFAULT_MONTHLY, FoodPreset, Foreign, LINE_KINDS, LineKind (+7 more)

### Community 16 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 17 - "newId"
Cohesion: 0.24
Nodes (13): finishSetup(), payTripCost(), txn(), newId(), normLine(), normPlan(), normSync(), normTrip() (+5 more)

### Community 18 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

### Community 19 - "core/money.ts"
Cohesion: 0.52
Nodes (6): convert(), decimal(), roundHalfUp(), symbol(), toMinor(), toSafe()

## Knowledge Gaps
- **8 isolated node(s):** `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)`, `DateBudget site`, `EXPO_PUBLIC_FIREBASE_API_KEY (.env.local)` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 136 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `DateScreen.tsx` to `ExpenseScreen.tsx`, `client.ts`, `ai.ts`, `HomeScreen.tsx`, `ExpenseScreen.tsx`, `package.json`, `store.ts`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ExpenseScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06680080482897384 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `ExpenseScreen.tsx` to `ai.ts`, `HomeScreen.tsx`, `ExpenseScreen.tsx`, `package.json`, `DateScreen.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `BudgetScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09045680687471733 - nodes in this community are weakly interconnected._
- **Why does `Small()` connect `HomeScreen.tsx` to `ExpenseScreen.tsx`, `BudgetScreen.tsx`, `ai.ts`, `ExpenseScreen.tsx`, `DateScreen.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `ai.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06599597585513078 - nodes in this community are weakly interconnected._