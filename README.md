# Almanac

A personal daily brief for your phone: today's and tomorrow's calendar events,
a simple task list, and a 6:30 AM notification that your day is ready.

Built with Expo SDK 57. Always check the versioned docs at
<https://docs.expo.dev/versions/v57.0.0/> before changing native-facing code.

This app runs as an EAS development build installed directly on the phone.
It does not target Expo Go: the calendar API and notifications it uses are
not available there.

## One-time setup

```bash
npm install
npm install --global eas-cli
eas login
eas init
```

`eas init` links this folder to a project on your Expo account and writes the
project ID into `app.json`. The build profiles are already in `eas.json`.

## Build and install the APK

```bash
npm run build:dev:android
```

The build runs in the cloud and takes a few minutes. When it finishes, the CLI
prints a link and QR code. Open it on the phone to download and install the
APK (allow installs from unknown sources if Android asks).

For iOS use `npm run build:dev:ios` (physical iPhone, needs an Apple developer
account) or `eas build --platform ios --profile development-simulator`.

## Day-to-day development

```bash
npm start
```

Open the installed Almanac app; it connects to the dev server and hot reloads
JavaScript changes. Rebuild the APK only when native dependencies or
`app.json` plugin settings change.

## Notes

- The bundle identifier / Android package is `com.iamdegroot.almanac` in
  `app.json`. Change it before the first build if you want a different one.
- `preview` and `production` profiles in `eas.json` produce standalone builds
  that do not need the dev server.
