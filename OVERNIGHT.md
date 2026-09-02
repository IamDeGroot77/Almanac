# Overnight batch, night of Sept 2

Everything below is committed on `main` and, apart from the two native
modules, already running on the phone through the dev server. Build 1.2.0
adds the native pieces.

## What to look at first

1. **Install build 1.2.0**: https://expo.dev/artifacts/eas/-qg26hvsMaqv86bm1u4XMG2QOx4ueW-kRoheil7Lxfo.apk (adds Health Connect sleep; the app now needs Android 8 or newer).
2. **Settings**: pick a weather place, choose Light/Dark, turn on "Quick add
   from the shade", set the check-in interval, connect Health Connect if
   Samsung Health syncs sleep to it.
3. **Today**: the week strip, weather line, timeline, Now toggle, and the
   "Just one thing" button.
4. **Long-press any task**: steps, "Break it down", when-and-where, notes,
   estimate calibration.
5. **Insights**: the week's letter at the top.

## Cleanup

- App.js split into hooks (`src/hooks/`): almanac day, people filter, Today derivations.
- One notification-response router (`src/notificationRouter.js`).
- Dead exports removed; `ARCHITECTURE.md` documents the pieces and how to add a feature.

## Features

- Undo bar after delete / clear completed.
- Task notes (synced to Google Tasks), search on Lists.
- Energy check-ins: morning (Today), 1 PM notification, evening (wrap-up); Insights compares.
- Steps under tasks; Break it down templates with backward-planned dates; next smallest step on rows and Focus; finishing the last step offers to finish the parent; steps nest in Google Tasks.
- Just one thing: picks the next task worth starting and opens Focus.
- Week strip (7 days, counts, highs); any day of the week can be planned.
- Weather + sunrise/sunset (Open-Meteo, free).
- Day timeline bar with events, deadlines, and a now line.
- Now mode toggle.
- Dark mode (Settings > Appearance; applies on next launch).
- Focus blocks (25/50 min) with a watch-visible notification and end chime; Focusmate link.
- Occasional reward line on Finish; always for carried-twice tasks or beating the estimate.
- Weekly letter on Insights, Sunday 6 PM nudge.
- When-and-where on the task sheet.
- Estimate calibration hint.
- Empty-state nudges.
- Health Connect sleep from the watch (native module, build 1.2.0).

## Held for when you're awake

- Laptop version with Drive sync (needs a Google web client set up).
- "I'm up" as a notification button (tune together).
- Any gamification beyond the reward line (wait for data).
- Haptics: React Native's Vibration is available but taste matters; not added.
