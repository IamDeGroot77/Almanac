package org.almanac.alarm

import android.app.AlarmManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the next alarm the clock app has set (AlarmManager.getNextAlarmClock),
 * so the morning brief can land right after it. No permission needed; the
 * clock app publishes this for the lock screen and status bar already.
 */
class AlmanacAlarmModule : Module() {
  private fun nextAlarmMs(): Double? {
    val ctx = appContext.reactContext ?: return null
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return null
    val info = am.nextAlarmClock ?: return null
    return info.triggerTime.toDouble()
  }

  override fun definition() = ModuleDefinition {
    Name("AlmanacAlarm")

    // Epoch milliseconds of the next alarm, or null when none is set.
    Function("nextAlarm") { -> nextAlarmMs() }
  }
}
