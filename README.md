# Almanac

A personal daily brief for your phone: today's and tomorrow's calendar events,
a simple task list, and a 6:30 AM notification that your day is ready.

Built with Expo SDK 57. Always check the versioned docs at
<https://docs.expo.dev/versions/v57.0.0/> before changing native-facing code.

## Run in Expo Go (quick preview)

```bash
npm install
npm start
```

Scan the QR code with the Expo Go app. Calendar and tasks work here. The
daily notification does **not**: Expo Go dropped notification support in
SDK 53, so the app shows a footer note instead.

## Run the development build (full features)

One-time setup:

```bash
npm install --global eas-cli
eas login
eas init
```

`eas init` links this folder to a project on your Expo account and writes the
project ID into `app.json`. The build profiles are already in `eas.json`.

Build once per platform (runs in the cloud, takes a few minutes):

```bash
npm run build:dev:android
```

```bash
npm run build:dev:ios
```

For the iOS Simulator instead of a physical iPhone:

```bash
eas build --platform ios --profile development-simulator
```

When the build finishes, install it on your device from the link or QR code
the CLI prints. Then start the dev server and open the app:

```bash
npm start
```

The development build launches the same JavaScript as Expo Go, so day-to-day
edits still hot reload. Rebuild only when native dependencies change.

## Notes

- The bundle identifier / Android package is `com.iamdegroot.almanac` in
  `app.json`. Change it before the first build if you want a different one.
- `expo-calendar/legacy` is used on purpose. The newer class-based calendar API
  is stubbed out in Expo Go. Switch once the app only runs from the dev build.
