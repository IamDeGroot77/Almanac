package org.almanac.health

import android.content.Context
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Reads sleep sessions from Health Connect, where Samsung Health, Fitbit and
 * other trackers write what the watch recorded. Read-only, sleep only.
 */
class AlmanacHealthModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val sleepPermission = HealthPermission.getReadPermission(SleepSessionRecord::class)
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("AlmanacHealth")

    // 1 = unavailable, 2 = provider update required, 3 = available
    Function("sdkStatus") { HealthConnectClient.getSdkStatus(context) }

    AsyncFunction("hasPermissionAsync").Coroutine { ->
      if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) return@Coroutine false
      val client = HealthConnectClient.getOrCreate(context)
      client.permissionController.getGrantedPermissions().contains(sleepPermission)
    }

    AsyncFunction("requestPermissionAsync") { promise: Promise ->
      if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val contract = PermissionController.createRequestPermissionResultContract()
      val intent = contract.createIntent(context, setOf(sleepPermission))
      val launchable = intent.resolveActivity(context.packageManager) != null

      // On Android 14+ Health Connect is part of the system and its
      // permissions go through the ordinary runtime-permission dialog. The
      // contract then yields a synthetic intent nothing can launch, so ask
      // the normal way instead.
      if (Build.VERSION.SDK_INT >= 34 || !launchable) {
        val permissions = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()
        permissions.askForPermissions(
          { result -> promise.resolve(result[sleepPermission]?.status == PermissionsStatus.GRANTED) },
          sleepPermission
        )
        return@AsyncFunction
      }

      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      pending = promise
      activity.startActivityForResult(intent, REQUEST_CODE)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val granted = try {
        PermissionController.createRequestPermissionResultContract().parseResult(payload.resultCode, payload.data)
      } catch (e: Exception) {
        emptySet()
      }
      pending?.resolve(granted.contains(sleepPermission))
      pending = null
    }

    // JSON array of { start, end, title, source } for the last `days` days.
    AsyncFunction("readSleepJsonAsync").Coroutine { days: Int ->
      val client = HealthConnectClient.getOrCreate(context)
      val end = Instant.now()
      val start = end.minus(days.toLong().coerceIn(1, 60), ChronoUnit.DAYS)
      val response = client.readRecords(
        ReadRecordsRequest(SleepSessionRecord::class, timeRangeFilter = TimeRangeFilter.between(start, end))
      )
      val out = JSONArray()
      for (r in response.records) {
        out.put(
          JSONObject()
            .put("start", r.startTime.toEpochMilli())
            .put("end", r.endTime.toEpochMilli())
            .put("title", r.title ?: "")
            .put("source", r.metadata.dataOrigin.packageName)
        )
      }
      out.toString()
    }
  }

  companion object {
    private const val REQUEST_CODE = 9271
  }
}
