package org.almanac.sleep

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.SleepSegmentRequest

/**
 * Sleep API subscriptions do not survive a reboot. If the app had one, ask
 * for it again when the phone comes back up, so the next night still counts.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != "android.intent.action.QUICKBOOT_POWERON") return
    if (!SleepStore.isSubscribed(context)) return
    try {
      val target = Intent(context, SleepReceiver::class.java)
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
      val pending = PendingIntent.getBroadcast(context, 1001, target, flags)
      ActivityRecognition.getClient(context)
        .requestSleepSegmentUpdates(pending, SleepSegmentRequest.getDefaultSleepSegmentRequest())
    } catch (e: Exception) {
      // Permission may have been revoked; the app re-subscribes on next open.
    }
  }
}
