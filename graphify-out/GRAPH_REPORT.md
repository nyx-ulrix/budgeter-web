# Graph Report - BudgeterWeb  (2026-10-23)

## Corpus Check
- 50 files · ~64,330 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 618 nodes · 2197 edges · 15 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d777bc63`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ProfileScreen.tsx
- state.ts
- TripScreen.tsx
- sheets.ts
- ExpenseScreen.tsx
- dependencies
- MacrosScreen.tsx
- expo
- DateScreen.tsx
- Budgeter Web
- AGENTS.md
- tsconfig.json
- MonthBar.tsx
- sheets.test.ts
- client.ts

## God Nodes (most connected - your core abstractions)
1. `money()` - 36 edges
2. `useAppState()` - 34 edges
3. `currency()` - 32 edges
4. `todayIso()` - 31 edges
5. `useNav()` - 31 edges
6. `snapshot` - 28 edges
7. `ExpenseScreen()` - 26 edges
8. `parseMoney()` - 25 edges
9. `periodOf()` - 24 edges
10. `plain()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `startSync()`  [EXTRACTED]
  App.tsx → src/sync/sheets.ts
- `Root()` --calls--> `useAppState()`  [EXTRACTED]
  App.tsx → src/data/store.ts
- `Toolbar()` --calls--> `snapshot`  [EXTRACTED]
  App.tsx → src/data/ledger.ts
- `Toolbar()` --calls--> `useAppState()`  [EXTRACTED]
  App.tsx → src/data/store.ts
- `BottomBar()` --calls--> `useNav()`  [EXTRACTED]
  App.tsx → src/ui/nav.tsx

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "ProfileScreen.tsx"
Cohesion: 0.05
Nodes (84): App(), BottomBar(), Root(), ScanningOverlay(), SideBar(), TABS, Toolbar(), Ai (+76 more)

### Community 1 - "state.ts"
Cohesion: 0.07
Nodes (69): addTrip(), buyNow(), deletePlanned(), deleteTrip(), deleteTripCost(), deleteTxn(), mapPlans(), notNull() (+61 more)

### Community 2 - "TripScreen.tsx"
Cohesion: 0.09
Nodes (64): addDays(), clamp(), Day, daysBetween(), epochDay(), fromEpochDay(), isoDate(), makeDay() (+56 more)

### Community 3 - "sheets.ts"
Cohesion: 0.12
Nodes (30): renewOnTap(), store, GoogleButton(), CLIENT_ID, currentToken(), DRIVE_FILE, loadGis(), requestToken() (+22 more)

### Community 4 - "ExpenseScreen.tsx"
Cohesion: 0.07
Nodes (54): DaySpend, validDate(), allocate(), convert(), decimal(), DIGITS, parseMoney(), roundHalfUp() (+46 more)

### Community 5 - "dependencies"
Cohesion: 0.05
Nodes (37): expo, expo-font, @expo/metro-runtime, expo-status-bar, dependencies, expo, expo-font, @expo/metro-runtime (+29 more)

### Community 6 - "MacrosScreen.tsx"
Cohesion: 0.09
Nodes (47): Provider, aiMacros(), FoodHit, GRAMS, gramsOf(), jsonIn(), lookupFood(), macrosIn() (+39 more)

### Community 7 - "expo"
Cohesion: 0.07
Nodes (26): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, expo, android (+18 more)

### Community 8 - "DateScreen.tsx"
Cohesion: 0.10
Nodes (54): inPeriod(), todayIso(), money(), plain(), togglePaidBack(), currency(), liveTxns(), tripSpent() (+46 more)

### Community 9 - "Budgeter Web"
Cohesion: 0.25
Nodes (7): Budgeter Web, Data, Deploy, Develop, Keys, Receipts, Shared with the phone app

### Community 10 - "AGENTS.md"
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

### Community 11 - "tsconfig.json"
Cohesion: 0.40
Nodes (4): expo/tsconfig.base, compilerOptions, strict, extends

### Community 12 - "MonthBar.tsx"
Cohesion: 0.15
Nodes (19): DEFAULT_CATEGORIES, Body(), KeyValue(), PixelDialog(), Rule(), Small(), alertColor(), barTotal() (+11 more)

### Community 13 - "sheets.test.ts"
Cohesion: 0.25
Nodes (3): mem, tabs, writes

### Community 14 - "client.ts"
Cohesion: 0.07
Nodes (46): chat(), http(), keyOf(), models(), parse(), read(), safeBase(), db() (+38 more)

## Knowledge Gaps
- **109 isolated node(s):** `TABS`, `name`, `slug`, `version`, `orientation` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PictureButtons()` connect `ProfileScreen.tsx` to `DateScreen.tsx`, `dependencies`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Why does `react` connect `dependencies` to `ProfileScreen.tsx`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **What connects `TABS`, `name`, `slug` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ProfileScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05490734385724091 - nodes in this community are weakly interconnected._
- **Should `state.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07245386192754613 - nodes in this community are weakly interconnected._
- **Should `TripScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09026915113871635 - nodes in this community are weakly interconnected._
- **Should `sheets.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12299465240641712 - nodes in this community are weakly interconnected._