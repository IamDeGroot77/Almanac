package org.almanac.alarm

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the next alarm the clock app has set (AlarmManager.getNextAlarmClock),
 * so the morning brief can land right after it, and reports whether the app
 * may schedule exact alarms (Android 12+), which is what makes the brief land
 * on the minute rather than within an hour.
 */
class AlmanacAlarmModule : Module() {
  private fun alarmManager(): AlarmManager? =
    appContext.reactContext?.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

  private fun nextAlarmMs(): Double? {
    val info = alarmManager()?.nextAlarmClock ?: return null
    return info.triggerTime.toDouble()
  }

  private fun canScheduleExact(): Boolean {
    val am = alarmManager() ?: return false
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.canScheduleExactAlarms() else true
  }

  private fun openExactAlarmSettings(): Boolean {
    val ctx = appContext.reactContext ?: return false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return false
    return try {
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + ctx.packageName))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AlmanacAlarm")

    // Epoch milliseconds of the next alarm, or null when none is set.
    Function("nextAlarm") { -> nextAlarmMs() }

    // Whether notifications can be scheduled to the minute.
    Function("canScheduleExact") { -> canScheduleExact() }

    // Opens the system page where the user can allow exact alarms.
    Function("openExactAlarmSettings") { -> openExactAlarmSettings() }
  }
}
