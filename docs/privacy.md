---
title: Almanac Privacy Policy
---

# Almanac Privacy Policy

Last updated: September 3, 2026

Almanac is a personal daily-brief app, built and used by its author. It runs
as an Android app and as a web page. It has no accounts of its own, no
servers, no analytics, and no advertising. Everything below describes what
the app does with data on the author's behalf; nothing is collected by or
sent to the author from anyone else.

## What the app stores on your devices

Tasks, lists, routines, categories, day records (when the day started and
ended, energy answers, detected sleep), journal entries, working-memory
notes, achievements, and settings are stored on the device: in the app's
private storage on Android, and in the browser's local storage on the web.
Sign-in tokens and the Canvas access token are stored in the Android secure
keystore; on the web the short-lived Google access token is kept in local
storage. Uninstalling the app or clearing site data removes it.

## Permissions on Android and what they are for

- **Calendar (read and write).** Reads events to show the day, and, if you
  turn on assignment mirroring or calendar rules, creates, updates, and
  deletes events it made itself, with reminders.
- **Notifications.** Morning brief, bedtime nudge, task reminders,
  check-ins, energy checks, the Sunday letter, and a quick-add notification
  with voice replies. All local; nothing is sent anywhere.
- **Exact alarms.** So the brief lands at the alarm time rather than within
  an hour of it.
- **Physical activity.** Android's sleep detection, to fill in a forgotten
  "I'm up" or "Going to bed".
- **Health Connect (sleep).** Reads sleep sessions recorded by a watch to do
  the same, more accurately. Sleep data is stored with the day record and
  is included in device sync (see below). Almanac never writes to Health
  Connect and never shares health data with anyone.
- **Read the next alarm.** So the morning brief can follow your alarm clock.

## Google

If you connect a Google account, Almanac asks for:

- **Google Tasks** to keep named lists in two-way sync with your Google
  Tasks lists.
- **Drive app data** to keep one private file in your Drive's app storage
  that carries the app's state between your phone and your laptop. It holds
  tasks, lists, routines, day records including sleep, journal entries,
  notes, and "why am I stuck" answers. It is not encrypted beyond Google's
  own storage encryption, and anyone with access to your Google account or
  a valid token could read it.
- **Drive files created by the app** for a folder called "Almanac Drop",
  used to pass files between devices. The app only sees files it created.
- **Google Calendar (web only)** to show and edit your calendars in the
  laptop's Calendar view.
- **Your email address** to show which account is connected.

You can disconnect in Settings, which deletes the stored tokens, and revoke
access at <https://myaccount.google.com/permissions>.

## Canvas

If you enter a Canvas personal access token, Almanac reads your courses,
assignments, and grades from your school's Canvas server to build the
School list. The token is stored only on the phone's secure keystore and
never in the Drive file. Remove it in Settings at any time.

## Other services

- **Open-Meteo** receives the coordinates of the place you chose for
  weather. Nothing else.
- **EAS Update (Expo)** delivers app updates. The app sends its version and
  platform to fetch them; no personal data.

## Zeke

Tasks tagged for the author's child are notes made by a parent in a private
app. The child has no account and no access.

## Google API Services

Almanac's use of information received from Google APIs adheres to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the Limited Use requirements.

## The assistant

If you add an Anthropic API key in Settings > Assistant, each line you type into "Tell Almanac" is sent to Anthropic's API together with a snapshot of your lists, categories, people, routine names, this week's tasks, and working memory. Your journal is never sent. Nothing is sent unless you use the box. The key lives in the device keystore and is never synced. Remove the key and the box works offline.
