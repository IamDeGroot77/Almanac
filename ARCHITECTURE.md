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
| Sleep | `modules/almanac-sleep/`, `modules/almanac-health/`, `src/sleep.js` | Two local Kotlin Expo modules: Google's Sleep API (phone) and Health Connect (watch). Both fold into the day bracket; watch data wins. |
| Steps & picking | `src/pickNext.js`, `src/breakdown.js` | Sub-task helpers, "Just one thing" scoring, break-it-down templates and backward planning. |
| Focus | `src/focusSession.js`, `src/components/FocusModal.js` | Full-screen task, next smallest step, 25/50 minute blocks, hand-off apps. |
| Weather | `src/weather.js` | Open-Meteo forecast and daylight, geocoded place in prefs, hourly cache. |
| Letters & rewards | `src/weeklyLetterText.js`, `src/weeklyLetter.js`, `src/rewards.js` | The Sunday letter (pure composer + reminder hook) and the occasional line on Finish. |
| Energy | `src/energy.js`, `src/components/EnergyPrompt.js` | Three-tap energy checks; midday one is a notification. |
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

## Laptop (web) and device sync

- The same code builds for the browser: `npm run build:web` writes `docs/app/`, which GitHub Pages serves at `https://iamdegroot77.github.io/Almanac/app/` (`experiments.baseUrl` in app.json; `docs/_config.yml` tells Jekyll to publish the `_expo` folder).
- `src/platform.js` (`isWeb`) gates phone-only features; `src/secure.js` swaps SecureStore for localStorage on the web.
- Google on the web uses Google Identity Services (`src/google/authWeb.js`) with a Web-application OAuth client (`extra.googleWebClientId`).
- `src/drive/` keeps devices in step through a private file in Drive's app-data folder: `merge.js` (pure, tested by `scripts/test-merge.mjs`), `driveApi.js`, `useDriveSync.js`. The phone stays the hub for Google Tasks, Canvas, and the calendar; the laptop receives those through Drive.
- Laptop-only tabs live in `src/screens/web/`: `PlannerScreen` (week columns, drag and drop), `SemesterScreen` (courses × weeks), `DashboardSections` (charts), `CalendarScreen` (month grid over the Google Calendar API, `src/google/calendarApi.js`, needs the `calendar.events` scope on the web client), and `FilesScreen` (the drop box).
- The drop box is a normal Drive folder called "Almanac Drop" (`src/drive/filesApi.js`, `drive.file` scope, so the app only sees files it made). The laptop uploads by drag and drop; the phone lists the folder at the bottom of Lists (`DropBoxSection`) and opens files in Drive. Sending from the phone needs a file picker native module, planned for the next build.

## Capture

- Working memory (`src/scratch.js` pure, tested by `scripts/test-scratch.mjs`; `components/ScratchCard.js` at the top of Today on both devices): a few notes you're holding right now, with Hold / Task / Journal / drop, an age label, and "Clear N old" for notes from earlier days. The shade notification's third button, "Hold a thought", captures by voice. Merged across devices by id.
- Journal (`src/journal.js` pure, tested by `scripts/test-journal.mjs`; `screens/JournalScreen.js`, a Journal tab on both devices): entries per almanac day with time, an optional prompt (one rotates per day; "What got in the way?" and the skip question are always offered), search, edit and delete (tombstones). Spoken notes from the shade or watch land here, and the Sunday letter notification carries an "Answer" text field for "What made you skip a day this week?" that files straight into the journal. Merged across devices by entry id.

- "Paste a list" on the Lists tab (`components/ImportBox.js`) turns a brain dump into lists, tasks, steps, dates, times, people, and notes. The parser is `src/importText.js` (pure, tested by `scripts/test-import.mjs`); the store applies the plan in one edit (`importPlan`), so it syncs to Google Tasks and the other device like any edit.

## Lists that do something

- Timeline lists (`src/consider.js`, tested by `scripts/test-lists.mjs`): a named list with a horizon (30/90/180 days, set in list options or via "(3 months)" in an import header) gives every task a due date that far out; after the nudge period (7/21/30 days) a task shows on Today under "Worth considering" with Today / Not yet (`snoozeConsideration` stamps `nudgedAt`).
- Timed routine items: a routine with `minutesPerDay` (a points goal, a minute is a point) or `warmup` shows Start on each item; Start hands off to the timer app (pref `timerApp`) and coming back to Almanac logs the elapsed time to `routineLog` (shared, merged by id) and ticks the item. Under a minute or over three hours logs nothing. `warmup` suggests a stretch when nothing on that routine finished in the last hour. A daily item `{ type: 'minutes', routineId, minutes }` reads today's minutes (`minutesToday`). Tested by `scripts/test-routines.mjs`.
- Routine quotas can count another routine's ticks (`{ type: 'quota', routineId, count }`), so a daily checklist can say "1 from Exercise" where Exercise is a weekly routine of workouts.
- Calendar rules (`src/calendarRules.js` pure, `src/useCalendarRules.js` on the phone, Settings → Calendar rules, pref `calendarRules` shared across devices): when an event whose title contains a keyword has ended, a task is made from a template ("Write article: {title}") on a chosen list, due N days later; `eventTasks` remembers which events were handled.

## Categories and day blocks

- `categories` in the store group lists (`list.categoryId`); set in list options, Settings → Categories and day blocks, or an import header "(in Work)". They merge across devices like lists.
- Day blocks (`prefs.dayBlocks`, shared): a category plus a start/end time and weekdays. `src/blocks.js` (pure, tested by `scripts/test-blocks.mjs`) finds the current and next block; Today shows a BlockCard with the three best tasks from every list in the category (`pickNext` over `categoryTasks`), the timeline shades the blocks, and "Just one thing" prefers the current block's category.

## From the research pass (2026-09-02)

- Dodged count: a task carried through the start-of-day review `carriedCount` times shows "dodged N days" on its row and in the wrap-up, so avoidance is a number rather than a feeling.
- First two-minute step: `task.firstStep` (task sheet), shown as "Start with: …" on the row until the task runs.
- Capacity: `src/capacity.js` (pure, tested by `scripts/test-capacity.mjs`) sums open estimates (20 min default for unestimated) against the bedtime pref and the Today list's subtitle reads "~1h 50m left · finishing 9:40 PM", in warn colour when past bedtime.
- Shutdown ritual: the wrap-up card lists what was done (the "have done" list) and asks per open item: Tomorrow / Next week / Drop (undoable).

- "Why am I stuck?" (`components/StuckSection.js` on the task sheet): four reasons (energy, clarity, dread, place), each with two defaults (first step only, move to tomorrow, break it down, journal prompt, set when and where). Answers go to `task.stuck` and `stuckLog` (shared), and Insights counts them.
- Dopamine menu: `prefs.dopamenu` (shared) edited in Settings; when an energy check-in is Low, Today shows a `DopamenuCard` with two or three small good things before the list.
- Skip tokens: a routine item can be skipped (-1 in `routineDone`), counting as complete for the period but not toward other routines' quotas; `skipsPerWeek` (default 2) tokens per routine per week, shown on the card. Never a broken streak.
- Words: "Slipped" instead of "Overdue".

## Adherence (the phone does the initiating)

- The morning brief follows the alarm clock: `modules/almanac-alarm` reads `AlarmManager.getNextAlarmClock`; `scheduleMorningBrief` in `src/notifications.js` schedules a one-off a minute after an alarm within 20 hours, else the brief is sent when the day auto-starts (`sendBriefIfDue`, once per day). Re-checked whenever the app comes to the foreground or goes to the background, so set the alarm before closing Almanac for the night if you want the brief tied to it.
- `src/dayBracket.js`: the morning brief carries "I'm up" and "Just one thing" buttons; a bedtime nudge (pref `bedtimeHour`, -1 = off) carries "Going to bed" and "Not yet" (asks again in 30 minutes). Handlers run through `notificationRouter.js`, so the buttons work from the shade and the watch without opening the app.
- Start of day happens by itself: `src/dayAuto.js` (pure, tested by `scripts/test-dayauto.mjs`) decides on each app open whether a clear stretch of sleep has passed (a detected segment ending after the last activity, or four hours without any); App applies it (`applyAutoStart`), resets the review, and refreshes. "I'm up" remains for correcting the time ("Just got up").
- Today starts in Now mode when more than five tasks are open (App.js).
- `usage` in the store counts app opens per calendar day, per device, never synced; `usageStats` in `src/insights.js` turns it into the "Am I using this?" table (`components/UsageTable.js`) shown on Insights and the laptop Dashboard.
