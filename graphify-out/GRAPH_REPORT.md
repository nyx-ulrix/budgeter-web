# Graph Report - budgeter-web  (2026-11-11)

## Corpus Check
- 50 files · ~50,280 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .ttf 4, (none) 3)

## Summary
- 681 nodes · 2918 edges · 12 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `15ff362c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- BudgetScreen.tsx
- ai.ts
- TripScreen.tsx
- ExpenseScreen.tsx
- Budgeter Web
- state.ts
- package.json
- expo
- ExpenseScreen.tsx
- AGENTS.md
- tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `Small()` - 61 edges
2. `ExpenseScreen()` - 55 edges
3. `PixelButton()` - 52 edges
4. `todayIso()` - 42 edges
5. `HomeScreen()` - 41 edges
6. `money()` - 40 edges
7. `Body()` - 39 edges
8. `useAppState()` - 38 edges
9. `BudgetScreen()` - 38 edges
10. `currency()` - 36 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `finishOpenRouter()`  [EXTRACTED]
  App.tsx → src/ai/openrouter.ts
- `Root()` --calls--> `todayIso()`  [EXTRACTED]
  App.tsx → src/core/budget.ts
- `Root()` --calls--> `syncDatePaid()`  [EXTRACTED]
  App.tsx → src/data/actions.ts
- `Root()` --calls--> `useAppState()`  [EXTRACTED]
  App.tsx → src/data/store.ts
- `Root()` --calls--> `useDate()`  [EXTRACTED]
  App.tsx → src/date/client.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared date budget on Firebase** — readme_date_budget, readme_firebase_project, readme_datebudget_site, readme_firebase_api_key [EXTRACTED 0.90]
- **Cross-device sync of Budgeter data** — readme_google_sheets_sync, readme_sync_tab, readme_records_sync_format, readme_last_change_wins [EXTRACTED 0.90]

## Communities (12 total, 0 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.08
Nodes (44): App(), BottomBar(), renewOnTap(), Root(), SideBar(), TABS, editSetup(), setSync() (+36 more)

### Community 1 - "BudgetScreen.tsx"
Cohesion: 0.06
Nodes (106): addDays(), clamp(), Day, daysBetween(), daySpend, epochDay(), fromEpochDay(), inPeriod() (+98 more)

### Community 3 - "ai.ts"
Cohesion: 0.07
Nodes (58): Ai, chat(), http(), keyOf(), models(), preset, PRESETS, Provider (+50 more)

### Community 4 - "TripScreen.tsx"
Cohesion: 0.10
Nodes (114): screen(), ScanningOverlay(), Toolbar(), PACE_LABEL, todayIso(), money(), parseMoney(), plain() (+106 more)

### Community 5 - "ExpenseScreen.tsx"
Cohesion: 0.08
Nodes (42): db(), key(), Secrets, Budget, create(), dateState, dec(), decFields() (+34 more)

### Community 7 - "Budgeter Web"
Cohesion: 0.07
Nodes (23): EAS build, submit, update, Expo dev commands (install, lint, tsc, doctor), Expo / React Native mobile app guidance, Expo Router navigation (src/app), Budgeter Android app, Budgeter Web, Data, Date budget (+15 more)

### Community 8 - "state.ts"
Cohesion: 0.05
Nodes (72): DEFAULT_TRACKED, payTripCost(), state(), txn(), canon(), Categories, encodeRecord(), mergeRemote() (+64 more)

### Community 9 - "package.json"
Cohesion: 0.06
Nodes (49): dependencies, expo@~57.0.28, expo-font@~57.0.4, @expo/metro-runtime@~57.0.16, expo-status-bar@~57.0.1, react@19.2.3, react-dom@19.2.3, react-native@0.86.3 (+41 more)

### Community 10 - "expo"
Cohesion: 0.08
Nodes (25): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+17 more)

### Community 11 - "ExpenseScreen.tsx"
Cohesion: 0.06
Nodes (65): tesseract.js@^7.0.0, tesseract.js, parse(), validDate(), allocate(), convert(), decimal(), digits (+57 more)

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

- **Why does `react` connect `package.json` to `App.tsx`, `BudgetScreen.tsx`, `ai.ts`, `TripScreen.tsx`, `ExpenseScreen.tsx`, `state.ts`, `ExpenseScreen.tsx`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `EAS build, submit, update`, `Expo Router navigation (src/app)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08470588235294117 - nodes in this community are weakly interconnected._
- **Why does `react-native` connect `package.json` to `App.tsx`, `BudgetScreen.tsx`, `ai.ts`, `TripScreen.tsx`, `ExpenseScreen.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `BudgetScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.061454311454311454 - nodes in this community are weakly interconnected._
- **Why does `Small()` connect `TripScreen.tsx` to `App.tsx`, `BudgetScreen.tsx`, `ai.ts`, `package.json`, `ExpenseScreen.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Should `ai.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.075 - nodes in this community are weakly interconnected._