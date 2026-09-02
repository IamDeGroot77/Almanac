package org.almanac.sleep

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.SleepClassifyEvent
import com.google.android.gms.location.SleepSegmentEvent

/** Receives sleep events from Play Services and stores them. */
class SleepReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    try {
      if (SleepSegmentEvent.hasEvents(intent)) {
        for (event in SleepSegmentEvent.extractEvents(intent)) {
          SleepStore.addSegment(context, event.startTimeMillis, event.endTimeMillis, event.status)
        }
      }
      if (SleepClassifyEvent.hasEvents(intent)) {
        for (event in SleepClassifyEvent.extractEvents(intent)) {
          SleepStore.addClassify(context, event.timestampMillis, event.confidence, event.light, event.motion)
        }
      }
    } catch (e: Exception) {
      Log.w("AlmanacSleep", "Failed to handle sleep event", e)
    }
  }
}
