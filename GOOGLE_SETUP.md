# Connecting Almanac to Google Tasks

Almanac syncs its standing lists (Groceries, Home, and so on) with Google
Tasks. That makes Gemini a way in: "Hey Gemini, add eggs to my Groceries list"
lands in Google Tasks, and Almanac pulls it in on the next sync.

This is a one-time setup with Google. It's free. It takes about ten minutes of
clicking through Google's console. Nothing here needs a credit card.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/> and sign in with the same Google
   account your phone's Gemini uses.
2. Click the project picker at the top and choose **New project**.
   Name it `Almanac` and click **Create**. Make sure it's selected afterward.

## 2. Turn on the Tasks API

1. Open <https://console.cloud.google.com/apis/library/tasks.googleapis.com>.
2. Click **Enable**.

## 3. Set up the consent screen

1. Open <https://console.cloud.google.com/auth/overview> and click
   **Get started**.
2. App name: `Almanac`. Support email: your address. Click **Next**.
3. Audience: choose **External**. This does not make anything public; it only
   means regular Google accounts (not a Workspace organisation) can sign in,
   and only the test users you list below.
4. Contact email: your address. Agree to the policy and click **Create**.
5. In the left menu open **Audience** and, under **Test users**, add the Google
   account your phone uses. Save.

While the app is in *Testing*, Google expires sign-ins after seven days and
Almanac will ask you to connect again. To stop that, come back to this
**Audience** page later and click **Publish app**. Google will show an
"unverified app" warning on the sign-in screen, which is expected for a
personal app; tap **Advanced** and continue. No review is needed.

## 4. Create the OAuth client (type iOS, even for Android)

Google no longer accepts browser-based sign-in for clients of type *Android*;
it wants Android apps to use its native sign-in kit. Clients of type *iOS*
still allow it, need no certificate fingerprint, and work from Android, so
that's what Almanac uses.

1. Open <https://console.cloud.google.com/auth/clients> and click
   **Create client**.
2. Application type: **iOS**.
3. Name: `Almanac`.
4. Bundle ID: `com.iamdegroot.almanac`
5. Leave App Store ID and Team ID empty. Click **Create**.
6. Copy the **Client ID**. It ends in `.apps.googleusercontent.com`.

(If you already created an Android client earlier, it does no harm. Leave it.)

## 5. Put the client ID in the app and rebuild once

In `app.json`, replace the placeholder:

```json
"extra": {
  "googleClientId": "PASTE_IOS_CLIENT_ID.apps.googleusercontent.com"
}
```

with your real client ID. The sign-in redirect scheme is derived from it and
baked into the native app, so this needs one APK rebuild:

```bash
npm run build:dev:android
```

Install the new APK. The **Google Tasks** section at the bottom of the app
then shows a **Connect Google Tasks** button.

## How the sync behaves

- Each standing list in Almanac is matched to a Google Tasks list by name.
  Missing ones are created on either side, so your Google "My Tasks" list
  appears in Almanac too.
- Day lists (Today / Tomorrow) never leave the phone.
- Whichever side changed more recently wins for a given task.
- Sync runs when the app opens, when it returns to the foreground, a few
  seconds after any edit, and when you pull to refresh or tap **Sync now**.
