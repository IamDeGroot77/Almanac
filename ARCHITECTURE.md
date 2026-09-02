# Almanac: how it's put together

A single-screen-per-tab Expo app. No navigation library, no global state
library. State lives in one store hook, sync engines are pure functions over
snapshots, and native features hide behind small modules.

## The pieces

| Area | Where | Notes |
|---|---|---|
| App shell | `App.js` | Mounts the store, the hooks below, the four tabs, and the modals. Reads like a table of contents. |
| Store | `src/store.js` | One `useState` object persisted to AsyncStorage. Every user edit goes through `edit()`, which bumps `localVersion` (so sync notices) and keeps the day bracket honest. Actions are plain methods. |
| The almanac day | `src/clock.js`, `src/hooks/useAlmanacDay.js` | "Today" is the day you opened with I'm up and haven't closed, even past midnight. Helpers read it from `clock.js`; App publishes it each render. |
| People filter | `src/hooks/usePeopleFilter.js` | Me / Zeke / All and what it narrows. |
| Today derivations | `src/hooks/useTodayDerived.js` | Review list, due sections, summary, wrap-up numbers. |
| Dates & due | `src/dates.js`, `src/due.js`, `src/durations.js` | Day keys are local `YYYY-MM-DD`. Due parsing accepts loose text. |
| Routines | `src/routines.js` | Daily/weekly lists with plain items and quotas; periods follow the almanac day. |
| Google Tasks | `src/google/` | `auth.js` (OAuth, iOS-type client), `tasksApi.js`, `sync.js` (pure two-way merge), `useGoogleSync.js` (triggers). |
| Canvas | `src/canvas/` | `api.js`, `auth.js` (token in SecureStore), `sync.js` (one-way pull into the School list), `useCanvasSync.js`. |
| Calendar | `src/useCalendarEvents.js`, `src/assignmentCalendar.js` | Read events for the almanac day; mirror assignments to a chosen calendar with alerts. |
| Notifications | `src/notifications.js`, `src/reminders.js`, `src/checkins.js`, `src/quickAdd.js`, `src/notificationRouter.js` | Daily brief, due reminders, "still working?" check-ins, voice quick add. All responses go through the router. |
| Sleep | `modules/almanac-sleep/`, `src/sleep.js` | Local Kotlin Expo module over Google's Sleep API; folded into the day bracket. |
| Insights | `src/insights.js`, `src/screens/InsightsScreen.js` | Pure calculations over the store. |
| Screens & components | `src/screens/`, `src/components/` | Presentational; they receive store actions as props. |

## Conventions

- **Sync engines are pure.** `runSync(snapshot, token)` and `runCanvasSync(snapshot, data)` return new lists/tasks; hooks apply the result with `applySyncResult` / `applyCanvasResult`, which keep anything created while the sync ran.
- **Change detection uses markers, not clocks.** A task is locally changed when `updatedAt > syncedUpdatedAt`; remotely changed when Google's `updated` is past `googleUpdated`.
- **Native is optional.** `modules/almanac-sleep/index.js` reports unavailable on a build without it. New native features should follow that pattern so the app never crashes on an older APK.
- **Node-testable files use explicit `.js` extensions** in imports (`sync.js`, `routines.js`, `due.js`, `insights.js`, `quickParse.js`). `npm test` runs `scripts/test-sync.mjs` and `scripts/test-canvas.mjs` against fake servers.

## Adding a feature

1. Data first: add fields or actions to `src/store.js`; keep defaults in `emptyState()` so old saves load.
2. Pure logic in its own file under `src/`, with a Node check if it has any.
3. A hook if it needs effects (timers, listeners, notifications). Register notification handlers through `notificationRouter`.
4. Wire it in `App.js` and pass actions to a screen or component as props.
5. `npx expo export --platform android` to bundle-check, `npm test`, commit.
6. Rebuild the APK only for native modules, `app.json` plugins, or scheme changes (`npm run build:dev:android`).

## Builds

- `eas.json` profiles: `development` (dev client APK, auto-increment versionCode), `preview`, `production`.
- `app.config.js` derives the Google redirect scheme from the client ID and declares launchable packages; `plugins/withAppQueries.js` writes the manifest queries.
- `scripts/make-icons.js` regenerates the icon set from `assets/icon-new.png`.
