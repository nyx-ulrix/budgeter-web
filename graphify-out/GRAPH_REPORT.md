# Graph Report - budgeter-web  (2026-10-27)

## Corpus Check
- 50 files · ~45,758 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .ttf 4, (none) 3)

## Summary
- 656 nodes · 2729 edges · 13 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 21 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e14c5ec3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ExpenseScreen.tsx
- BudgetScreen.tsx
- DateScreen.tsx
- ai.ts
- MonthBar.tsx
- core.test.ts
- state.ts
- Budgeter Web
- sheets.ts
- package.json
- expo
- AGENTS.md
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `Small()` - 58 edges
2. `ExpenseScreen()` - 53 edges
3. `PixelButton()` - 49 edges
4. `HomeScreen()` - 40 edges
5. `BudgetScreen()` - 38 edges
6. `Body()` - 38 edges
7. `money()` - 37 edges
8. `todayIso()` - 36 edges
9. `Label()` - 35 edges
10. `currency()` - 34 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `resume()`  [EXTRACTED]
  App.tsx → src/date/client.ts
- `App()` --calls--> `preloadGoogle()`  [EXTRACTED]
  App.tsx → src/sync/google.ts
- `Root()` --calls--> `useAppState()`  [EXTRACTED]
  App.tsx → src/data/store.ts
- `Root()` --calls--> `ScannerProvider()`  [EXTRACTED]
  App.tsx → src/ocr/scanner.tsx
- `screen()` --calls--> `BudgetScreen()`  [EXTRACTED]
  App.tsx → src/screens/BudgetScreen.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cross-device sync of Budgeter data** — readme_google_sheets_sync, readme_sync_tab, readme_records_sync_format, readme_last_change_wins [EXTRACTED 0.90]
- **Shared date budget on Firebase** — readme_date_budget, readme_firebase_project, readme_datebudget_site, readme_firebase_api_key [EXTRACTED 0.90]

## Communities (13 total, 0 thin omitted)

### Community 0 - "ExpenseScreen.tsx"
Cohesion: 0.07
Nodes (99): App(), BottomBar(), renewOnTap(), Root(), screen(), ScanningOverlay(), SideBar(), TABS (+91 more)

### Community 1 - "BudgetScreen.tsx"
Cohesion: 0.08
Nodes (94): addDays(), clamp(), Day, daysBetween(), daySpend, epochDay(), fromEpochDay(), isoDate() (+86 more)

### Community 2 - "DateScreen.tsx"
Cohesion: 0.07
Nodes (77): inPeriod(), togglePaidBack(), debtors(), isSplit(), myShare(), store, addTx(), api() (+69 more)

### Community 3 - "ai.ts"
Cohesion: 0.10
Nodes (50): chat(), aiMacros(), FoodHit, GRAMS, gramsOf(), jsonIn(), lookupFood(), macrosIn() (+42 more)

### Community 4 - "MonthBar.tsx"
Cohesion: 0.24
Nodes (14): DEFAULT_CATEGORIES, alertColor(), barTotal(), CategoryColors, freeAndTarget(), MONTH_BLOCKS, MonthBar(), monthBlocks() (+6 more)

### Community 5 - "core.test.ts"
Cohesion: 0.05
Nodes (71): http(), keyOf(), models(), parse(), PRESETS, Provider, safeBase(), db() (+63 more)

### Community 6 - "state.ts"
Cohesion: 0.07
Nodes (65): buyNow(), deletePlanned(), deleteTrip(), deleteTxn(), finishSetup(), mapPlans(), notNull(), payTripCost() (+57 more)

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

### Community 16 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 18 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

## Knowledge Gaps
- **8 isolated node(s):** `expo/tsconfig.base`, `Tesseract in-browser OCR`, `DateBudget site`, `Browser localStorage data (no server)`, `EXPO_PUBLIC_FIREBASE_API_KEY (.env.local)` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 133 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `package.json` to `ExpenseScreen.tsx`, `BudgetScreen.tsx`, `DateScreen.tsx`, `ai.ts`, `MonthBar.tsx`, `core.test.ts`, `state.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `Tesseract in-browser OCR`, `DateBudget site` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ExpenseScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07016649677200136 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `ExpenseScreen.tsx` to `BudgetScreen.tsx`, `DateScreen.tsx`, `ai.ts`, `MonthBar.tsx`, `core.test.ts`, `package.json`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `BudgetScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07636363636363637 - nodes in this community are weakly interconnected._
- **Why does `Small()` connect `ai.ts` to `ExpenseScreen.tsx`, `BudgetScreen.tsx`, `DateScreen.tsx`, `MonthBar.tsx`, `core.test.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `DateScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0671484492622704 - nodes in this community are weakly interconnected._