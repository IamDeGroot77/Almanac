package org.almanac.sleep

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persists sleep events delivered by Google's Sleep API so JavaScript can read
 * them later, even if the app wasn't running when they arrived.
 */
object SleepStore {
  private const val PREFS = "almanac_sleep"
  private const val KEY_SEGMENTS = "segments"
  private const val KEY_CLASSIFY = "classify"
  private const val MAX_SEGMENTS = 400
  private const val MAX_CLASSIFY = 2000

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun read(context: Context, key: String): JSONArray =
    try { JSONArray(prefs(context).getString(key, "[]")) } catch (e: Exception) { JSONArray() }

  private fun write(context: Context, key: String, array: JSONArray, max: Int) {
    val trimmed = if (array.length() > max) {
      JSONArray().also { out -> for (i in array.length() - max until array.length()) out.put(array.get(i)) }
    } else array
    prefs(context).edit().putString(key, trimmed.toString()).apply()
  }

  fun addSegment(context: Context, start: Long, end: Long, status: Int) {
    val all = read(context, KEY_SEGMENTS)
    // De-duplicate: the API can redeliver the same segment.
    for (i in 0 until all.length()) {
      val o = all.getJSONObject(i)
      if (o.optLong("start") == start && o.optLong("end") == end) return
    }
    all.put(JSONObject().put("start", start).put("end", end).put("status", status).put("receivedAt", System.currentTimeMillis()))
    write(context, KEY_SEGMENTS, all, MAX_SEGMENTS)
  }

  fun addClassify(context: Context, timestamp: Long, confidence: Int, light: Int, motion: Int) {
    val all = read(context, KEY_CLASSIFY)
    all.put(JSONObject().put("timestamp", timestamp).put("confidence", confidence).put("light", light).put("motion", motion))
    write(context, KEY_CLASSIFY, all, MAX_CLASSIFY)
  }

  fun segments(context: Context): String = read(context, KEY_SEGMENTS).toString()
  fun classify(context: Context): String = read(context, KEY_CLASSIFY).toString()

  fun clear(context: Context) {
    prefs(context).edit().remove(KEY_SEGMENTS).remove(KEY_CLASSIFY).apply()
  }

  fun setSubscribed(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean("subscribed", value).apply()
  }

  fun isSubscribed(context: Context): Boolean = prefs(context).getBoolean("subscribed", false)
}
