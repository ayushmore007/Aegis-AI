package com.aegisai.app.data

import com.aegisai.app.AegisApp
import com.aegisai.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

object SessionHelper {
    private val http = OkHttpClient()

    suspend fun refreshUserFromToken(context: android.content.Context): Boolean = withContext(Dispatchers.IO) {
        val app = AegisApp.get(context)
        val prefs = app.prefs
        val token = prefs.accessToken?.takeIf { it.isNotBlank() } ?: return@withContext false
        val user = fetchUser(token) ?: return@withContext false

        val email = user.optString("email").takeIf { it.isNotBlank() }
        if (email != null) prefs.email = email

        val meta = user.optJSONObject("user_metadata")
        val name = meta?.optString("username")?.takeIf { it.isNotBlank() }
            ?: meta?.optString("full_name")?.takeIf { it.isNotBlank() }
            ?: email?.substringBefore("@")?.replaceFirstChar { it.uppercase() }
        if (name != null) prefs.username = name

        val phone = meta?.optString("phone")?.takeIf { it.isNotBlank() }
        if (phone != null) {
            prefs.phone = phone
            prefs.phoneVerified = meta.optBoolean("phone_verified", false)
        }

        // Restore/Merge history from cloud
        val cloudCalls = meta?.optString("call_history")
        val cloudSms = meta?.optString("sms_history")
        val cloudXp = meta?.optInt("training_xp", 0) ?: 0
        val cloudIdx = meta?.optInt("training_idx", 0) ?: 0
        var mergedAny = false

        if (!cloudCalls.isNullOrBlank()) {
            mergeHistory(context, "call_sessions", "sessions_json", cloudCalls, "id", "startedAt")
            mergedAny = true
        }
        if (!cloudSms.isNullOrBlank()) {
            mergeHistory(context, "sms_records", "records_json", cloudSms, "id", "timestamp")
            mergedAny = true
        }

        val trainingSp = context.getSharedPreferences("aegis_training", android.content.Context.MODE_PRIVATE)
        val localXp = trainingSp.getInt("xp", 0)
        val localIdx = trainingSp.getInt("idx", 0)
        if (cloudXp > localXp || cloudIdx > localIdx) {
            trainingSp.edit()
                .putInt("xp", maxOf(localXp, cloudXp))
                .putInt("idx", maxOf(localIdx, cloudIdx))
                .apply()
            mergedAny = true
        }

        if (mergedAny) {
            // Push merged back up to keep local & cloud in 100% sync
            syncHistoryWithCloud(context)
        }

        !prefs.email.isNullOrBlank()
    }

    suspend fun syncHistoryWithCloud(context: android.content.Context): Boolean = withContext(Dispatchers.IO) {
        val app = AegisApp.get(context)
        val prefs = app.prefs
        val token = prefs.accessToken?.takeIf { it.isNotBlank() } ?: return@withContext false

        val localCalls = context.getSharedPreferences("call_sessions", android.content.Context.MODE_PRIVATE)
            .getString("sessions_json", "[]") ?: "[]"
        val localSms = context.getSharedPreferences("sms_records", android.content.Context.MODE_PRIVATE)
            .getString("records_json", "[]") ?: "[]"
        val trainingSp = context.getSharedPreferences("aegis_training", android.content.Context.MODE_PRIVATE)
        val localXp = trainingSp.getInt("xp", 0)
        val localIdx = trainingSp.getInt("idx", 0)

        try {
            val payload = JSONObject().put("data", JSONObject()
                .put("call_history", localCalls)
                .put("sms_history", localSms)
                .put("training_xp", localXp)
                .put("training_idx", localIdx)
                .put("phone", prefs.phone ?: "")
                .put("phone_verified", prefs.phoneVerified)
                .put("username", prefs.username ?: "")
            )
            val req = Request.Builder()
                .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/user")
                .header("Authorization", "Bearer $token")
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .put(payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
                .build()

            http.newCall(req).execute().use { resp ->
                resp.isSuccessful
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun mergeHistory(
        context: android.content.Context,
        prefsName: String,
        keyName: String,
        cloudHistoryJson: String,
        idKey: String,
        timeKey: String
    ) {
        val sp = context.getSharedPreferences(prefsName, android.content.Context.MODE_PRIVATE)
        val localRaw = sp.getString(keyName, "[]") ?: "[]"

        try {
            val localArray = org.json.JSONArray(localRaw)
            val cloudArray = org.json.JSONArray(cloudHistoryJson)

            val map = LinkedHashMap<String, JSONObject>()

            // Add cloud entries first
            for (i in 0 until cloudArray.length()) {
                val item = cloudArray.optJSONObject(i) ?: continue
                val id = item.optString(idKey) ?: continue
                map[id] = item
            }

            // Add local entries (local overwrites cloud in case of conflicts)
            for (i in 0 until localArray.length()) {
                val item = localArray.optJSONObject(i) ?: continue
                val id = item.optString(idKey) ?: continue
                map[id] = item
            }

            // Sort by timestamp descending and take the last 50
            val sortedList = map.values.sortedByDescending { it.optLong(timeKey) }.take(50)

            val finalArray = org.json.JSONArray()
            for (item in sortedList) {
                finalArray.put(item)
            }

            sp.edit().putString(keyName, finalArray.toString()).apply()
        } catch (_: Exception) { }
    }

    fun fetchUser(accessToken: String): JSONObject? {
        return try {
            val req = Request.Builder()
                .url("${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/user")
                .header("Authorization", "Bearer $accessToken")
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .get()
                .build()
            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) return null
                JSONObject(resp.body?.string() ?: return null)
            }
        } catch (_: Exception) {
            null
        }
    }

    fun emailLocalPart(email: String?): String? {
        if (email.isNullOrBlank() || !email.contains("@")) return null
        return email.substringBefore("@")
    }
}
