# Budgeter Web

The web version of [Budgeter](https://github.com/nyx-ulrix/budgeter), the pixel-art budget planner. Same features as the Android app (daily budget with carry-over, receipt scanning with AI, bill splitting, trips, planned purchases, savings target), built with React Native for Web (Expo). No widgets.

Live at **https://app.budgeter.liewjiaen.com**.

## Shared with the phone app

Turn on Google Sheets sync in both apps with the same Google account and they share everything: expenses, budget lines, planned purchases, trips, categories and settings. Both apps use one spreadsheet called "Budgeter":

- a readable tab per budget month, one row per expense;
- a hidden `_sync` tab with one row per record (`setup`, `categories`, `plan:<month>`, `txn:<id>`, `planned:<id>`, `trip:<id>`), each with the time it last changed. On every sync each app takes the records the other changed more recently and writes its own newer ones. Deletions are kept as empty rows so they win too.

The web app syncs when it opens, after each change, when you come back to the tab, and every minute while it's open. The phone syncs after each change and whenever the app is opened.

Limits:
- Last change wins per record. Editing the same expense on both devices within a minute keeps only the later edit.
- Google sign-in in a browser lasts about an hour. After that the app renews it on your next tap, so you may see a sign-in popup flash.

## Receipts

With an AI provider set (Profile → AI), the receipt photo is sent to it to read (shrunk to 1600 px). Models that can't read images get the text read in your browser instead (Tesseract, which downloads about 10 MB the first time). Without a provider, the built-in reader runs entirely in your browser. AI keys are encrypted in this browser only and aren't synced to the phone.

## Data

Everything lives in your browser's storage (localStorage) and, with sync on, in your own Google Sheet. There's no Budgeter server. Clearing the site's data removes the browser copy.

## Develop

```bash
npm install
npx expo start --web     # http://localhost:8081
npm test                 # logic tests (Node test runner via tsx)
npx tsc --noEmit         # typecheck
```

## Deploy

```bash
npx expo export -p web
firebase deploy --only hosting
```

Firebase project `budgeter-510810`, hosting site `budgeter-app`, custom domain `app.budgeter.liewjiaen.com`.

The logic in `src/core` and `src/data` is a line-by-line port of the Android app's Kotlin (`core/`, `data/`), with the same tests. Keep the two in step, especially `records.ts` / `Records.kt`, which define the shared sync format.
