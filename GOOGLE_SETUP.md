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
3. Audience: choose **External**. Click **Next**.
4. Contact email: your address. Agree to the policy and click **Create**.
5. In the left menu open **Audience** and, under **Test users**, add the Google
   account your phone uses. Save.

While the app is in *Testing*, Google expires sign-ins after seven days and
Almanac will ask you to connect again. To stop that, come back to this
**Audience** page later and click **Publish app**. Google will show an
"unverified app" warning on the sign-in screen, which is expected for a
personal app; tap **Advanced** and continue. No review is needed.

## 4. Create the Android client ID

1. Open <https://console.cloud.google.com/auth/clients> and click
   **Create client**.
2. Application type: **Android**.
3. Name: `Almanac Android`.
4. Package name: `com.iamdegroot.almanac`
5. SHA-1 certificate fingerprint: paste the value Claude gives you (it comes
   from the keystore EAS uses to sign the APK).
6. Click **Create**. Copy the **Client ID**. It ends in
   `.apps.googleusercontent.com`.

## 5. Put the client ID in the app

In `app.json`, replace the placeholder:

```json
"extra": {
  "googleAndroidClientId": "PASTE_ANDROID_CLIENT_ID.apps.googleusercontent.com"
}
```

with your real client ID. Save, and the running dev server picks it up. The
**Google Tasks** section at the bottom of the app then shows a
**Connect Google Tasks** button.

## How the sync behaves

- Each standing list in Almanac is matched to a Google Tasks list by name.
  Missing ones are created on either side, so your Google "My Tasks" list
  appears in Almanac too.
- Day lists (Today / Tomorrow) never leave the phone.
- Whichever side changed more recently wins for a given task.
- Sync runs when the app opens, when it returns to the foreground, a few
  seconds after any edit, and when you pull to refresh or tap **Sync now**.
