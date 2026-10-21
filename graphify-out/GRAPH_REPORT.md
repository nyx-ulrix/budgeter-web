# Graph Report - BudgeterWeb  (2026-10-22)

## Corpus Check
- 50 files · ~63,724 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 616 nodes · 2180 edges · 15 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `860a36a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TripScreen.tsx
- state.ts
- ledger.ts
- App.tsx
- ExpenseScreen.tsx
- dependencies
- MacrosScreen.tsx
- expo
- HomeScreen.tsx
- Budgeter Web
- AGENTS.md
- tsconfig.json
- ai.ts
- sheets.test.ts
- DateScreen.tsx

## God Nodes (most connected - your core abstractions)
1. `money()` - 36 edges
2. `useAppState()` - 34 edges
3. `currency()` - 32 edges
4. `todayIso()` - 31 edges
5. `useNav()` - 31 edges
6. `snapshot` - 28 edges
7. `parseMoney()` - 27 edges
8. `ExpenseScreen()` - 25 edges
9. `periodOf()` - 24 edges
10. `plain()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `BottomBar()` --calls--> `useNav()`  [EXTRACTED]
  App.tsx → src/ui/nav.tsx
- `SideBar()` --calls--> `useNav()`  [EXTRACTED]
  App.tsx → src/ui/nav.tsx
- `App()` --calls--> `finishOpenRouter()`  [EXTRACTED]
  App.tsx → src/ai/openrouter.ts
- `Root()` --calls--> `useAppState()`  [EXTRACTED]
  App.tsx → src/data/store.ts
- `Root()` --calls--> `useNav()`  [EXTRACTED]
  App.tsx → src/ui/nav.tsx

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "TripScreen.tsx"
Cohesion: 0.08
Nodes (71): addTrip(), editSetup(), saveTrip(), setCategories(), setDaily(), setSync(), countries(), Country (+63 more)

### Community 1 - "state.ts"
Cohesion: 0.06
Nodes (81): addLine(), buyNow(), deletePlanned(), deleteTrip(), deleteTripCost(), deleteTxn(), editPlan(), finishSetup() (+73 more)

### Community 2 - "ledger.ts"
Cohesion: 0.13
Nodes (43): addDays(), clamp(), Day, daysBetween(), epochDay(), fromEpochDay(), makeDay(), nextPeriod() (+35 more)

### Community 3 - "App.tsx"
Cohesion: 0.08
Nodes (45): App(), BottomBar(), renewOnTap(), Root(), ScanningOverlay(), SideBar(), TABS, personLabel() (+37 more)

### Community 4 - "ExpenseScreen.tsx"
Cohesion: 0.07
Nodes (60): DaySpend, isoDate(), pad(), periodOf(), periodOfKey(), validDate(), allocate(), convert() (+52 more)

### Community 5 - "dependencies"
Cohesion: 0.05
Nodes (37): expo, expo-font, @expo/metro-runtime, expo-status-bar, dependencies, expo, expo-font, @expo/metro-runtime (+29 more)

### Community 6 - "MacrosScreen.tsx"
Cohesion: 0.09
Nodes (45): aiMacros(), FoodHit, GRAMS, gramsOf(), jsonIn(), lookupFood(), macrosIn(), readHits() (+37 more)

### Community 7 - "expo"
Cohesion: 0.07
Nodes (26): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+18 more)

### Community 8 - "HomeScreen.tsx"
Cohesion: 0.11
Nodes (51): Toolbar(), inPeriod(), todayIso(), money(), currency(), liveTxns(), tripSpent(), DEFAULT_CATEGORIES (+43 more)

### Community 9 - "Budgeter Web"
Cohesion: 0.25
Nodes (7): Budgeter Web, Data, Deploy, Develop, Keys, Receipts, Shared with the phone app

### Community 10 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 11 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

### Community 12 - "ai.ts"
Cohesion: 0.11
Nodes (23): Ai, chat(), http(), keyOf(), models(), parse(), Preset, PRESETS (+15 more)

### Community 13 - "sheets.test.ts"
Cohesion: 0.25
Nodes (3): mem, tabs, writes

### Community 14 - "DateScreen.tsx"
Cohesion: 0.09
Nodes (46): addTx(), api(), Budget, create(), DateState, dec(), decFields(), deleteTx() (+38 more)

## Knowledge Gaps
- **109 isolated node(s):** `TABS`, `name`, `slug`, `version`, `orientation` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PictureButtons()` connect `TripScreen.tsx` to `HomeScreen.tsx`, `dependencies`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Why does `react` connect `dependencies` to `TripScreen.tsx`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **What connects `TABS`, `name`, `slug` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TripScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07919301415236375 - nodes in this community are weakly interconnected._
- **Should `state.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05799373040752351 - nodes in this community are weakly interconnected._
- **Should `ledger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13140096618357489 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._