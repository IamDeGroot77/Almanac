package org.almanac.sleep

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.SleepSegmentRequest
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin bridge to Google's Sleep API. Subscribing registers a PendingIntent
 * that Play Services fires with sleep segments (usually the next morning) and
 * periodic classify events; SleepReceiver stores them for JS to read.
 */
class AlmanacSleepModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun pendingIntent(): PendingIntent {
    val intent = Intent(context, SleepReceiver::class.java)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    return PendingIntent.getBroadcast(context, 1001, intent, flags)
  }

  private fun hasPermission(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACTIVITY_RECOGNITION) ==
      PackageManager.PERMISSION_GRANTED

  override fun definition() = ModuleDefinition {
    Name("AlmanacSleep")

    Function("hasPermission") { hasPermission() }

    Function("isSubscribed") { SleepStore.isSubscribed(context) }

    AsyncFunction("subscribeAsync") { promise: Promise ->
      if (!hasPermission()) {
        promise.reject("E_PERMISSION", "ACTIVITY_RECOGNITION permission not granted", null)
        return@AsyncFunction
      }
      try {
        ActivityRecognition.getClient(context)
          .requestSleepSegmentUpdates(pendingIntent(), SleepSegmentRequest.getDefaultSleepSegmentRequest())
          .addOnSuccessListener {
            SleepStore.setSubscribed(context, true)
            promise.resolve(true)
          }
          .addOnFailureListener { e -> promise.reject("E_SUBSCRIBE", e.message ?: "requestSleepSegmentUpdates failed", e) }
      } catch (e: Exception) {
        promise.reject("E_SUBSCRIBE", e.message ?: "requestSleepSegmentUpdates threw", e)
      }
    }

    AsyncFunction("unsubscribeAsync") { promise: Promise ->
      try {
        ActivityRecognition.getClient(context)
          .removeSleepSegmentUpdates(pendingIntent())
          .addOnSuccessListener {
            SleepStore.setSubscribed(context, false)
            promise.resolve(true)
          }
          .addOnFailureListener { e -> promise.reject("E_UNSUBSCRIBE", e.message ?: "removeSleepSegmentUpdates failed", e) }
      } catch (e: Exception) {
        promise.reject("E_UNSUBSCRIBE", e.message ?: "removeSleepSegmentUpdates threw", e)
      }
    }

    // JSON strings; parsed on the JS side.
    Function("getSegmentsJson") { SleepStore.segments(context) }
    Function("getClassifyJson") { SleepStore.classify(context) }
    Function("clear") { SleepStore.clear(context) }
  }
}
