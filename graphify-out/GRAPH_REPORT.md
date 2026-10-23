# Graph Report - .  (2026-10-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 639 nodes · 2222 edges · 20 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.62)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ef032cdd`
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
- dependencies
- expo
- web
- sheets.test.ts
- adaptiveIcon
- devDependencies
- scripts
- AGENTS.md
- package.json
- tsconfig.json
- expo-font

## God Nodes (most connected - your core abstractions)
1. `money()` - 36 edges
2. `useAppState()` - 34 edges
3. `currency()` - 32 edges
4. `todayIso()` - 31 edges
5. `useNav()` - 31 edges
6. `Snapshot` - 28 edges
7. `ExpenseScreen()` - 26 edges
8. `parseMoney()` - 25 edges
9. `periodOf()` - 24 edges
10. `plain()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Expo / React Native mobile app guidance` --conceptually_related_to--> `Budgeter Web`  [INFERRED]
  AGENTS.md → README.md
- `App()` --calls--> `finishOpenRouter()`  [EXTRACTED]
  App.tsx → src/ai/openrouter.ts
- `App()` --calls--> `startSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
- `renewOnTap()` --calls--> `queueSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
- `Toolbar()` --calls--> `Snapshot`  [EXTRACTED]
  App.tsx → src/data/ledger.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Cross-device sync of Budgeter data** — readme_google_sheets_sync, readme_sync_tab, readme_records_sync_format, readme_last_change_wins [EXTRACTED 0.90]
- **Shared date budget on Firebase** — readme_date_budget, readme_firebase_project, readme_datebudget_site, readme_firebase_api_key [EXTRACTED 0.90]

## Communities (20 total, 0 thin omitted)

### Community 0 - "ExpenseScreen.tsx"
Cohesion: 0.06
Nodes (98): App(), BottomBar(), renewOnTap(), Root(), SideBar(), TABS, Toolbar(), addTrip() (+90 more)

### Community 1 - "BudgetScreen.tsx"
Cohesion: 0.07
Nodes (84): addDays(), clamp(), Day, DaySpend, epochDay(), fromEpochDay(), isoDate(), makeDay() (+76 more)

### Community 2 - "DateScreen.tsx"
Cohesion: 0.07
Nodes (62): db(), key(), Secrets, inPeriod(), addTx(), api(), Budget, create() (+54 more)

### Community 3 - "ai.ts"
Cohesion: 0.05
Nodes (57): Ai, chat(), http(), keyOf(), models(), parse(), Preset, PRESETS (+49 more)

### Community 4 - "HomeScreen.tsx"
Cohesion: 0.08
Nodes (52): ScanningOverlay(), daysBetween(), todayIso(), money(), plain(), deleteTripCost(), togglePaidBack(), activeTrip() (+44 more)

### Community 5 - "core.test.ts"
Cohesion: 0.08
Nodes (46): validDate(), allocate(), convert(), decimal(), DIGITS, parseMoney(), roundHalfUp(), symbol() (+38 more)

### Community 6 - "state.ts"
Cohesion: 0.09
Nodes (45): payTripCost(), state(), txn(), canon(), Categories, encodeRecord(), mergeRemote(), recordObjects() (+37 more)

### Community 7 - "Budgeter Web"
Cohesion: 0.07
Nodes (29): Continuous Native Generation, EAS build, submit, update, Expo dev commands (install, lint, tsc, doctor), Fetch versioned Expo docs, do not trust training data, Expo / React Native mobile app guidance, Expo Router navigation (src/app), Budgeter Android app, Budgeter Web (+21 more)

### Community 8 - "sheets.ts"
Cohesion: 0.18
Nodes (23): personLabel(), addTab(), append(), batchUpdate(), col(), createSpreadsheet(), existingTabs(), findSpreadsheet() (+15 more)

### Community 9 - "dependencies"
Cohesion: 0.12
Nodes (17): expo, @expo/metro-runtime, expo-status-bar, dependencies, expo, @expo/metro-runtime, expo-status-bar, react (+9 more)

### Community 10 - "expo"
Cohesion: 0.20
Nodes (9): expo, icon, ios, name, orientation, slug, userInterfaceStyle, version (+1 more)

### Community 11 - "web"
Cohesion: 0.25
Nodes (8): web, backgroundColor, description, favicon, name, output, shortName, themeColor

### Community 12 - "sheets.test.ts"
Cohesion: 0.25
Nodes (3): mem, tabs, writes

### Community 13 - "adaptiveIcon"
Cohesion: 0.29
Nodes (7): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, android

### Community 14 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, tsx, @types/react, typescript, tsx, @types/react, typescript

### Community 15 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, android, build:web, ios, start, test, web

### Community 16 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 17 - "package.json"
Cohesion: 0.40
Nodes (4): main, name, private, version

### Community 18 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

### Community 19 - "expo-font"
Cohesion: 0.67
Nodes (3): plugins, expo-font, expo-font

## Knowledge Gaps
- **115 isolated node(s):** `Expo has changed — do not trust your training data`, `Commands`, `Navigation & Routing`, `Building with EAS`, `Rules` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-font` connect `expo-font` to `ExpenseScreen.tsx`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `expo-font`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `plugins` connect `expo-font` to `expo`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `Expo has changed — do not trust your training data`, `Commands`, `Navigation & Routing` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ExpenseScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06412047818661698 - nodes in this community are weakly interconnected._
- **Should `BudgetScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07032967032967033 - nodes in this community are weakly interconnected._
- **Should `DateScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06961770623742455 - nodes in this community are weakly interconnected._