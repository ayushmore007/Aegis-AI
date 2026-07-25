package com.aegisai.app.call

import android.content.Context
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object CallSessionStore {
    private const val PREFS = "call_sessions"
    private const val KEY_SESSIONS = "sessions_json"

    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val listType = Types.newParameterizedType(List::class.java, CallSession::class.java)
    private val adapter = moshi.adapter<List<CallSession>>(listType)

    fun createSession(context: Context, phoneNumber: String?): CallSession {
        val session = CallSession(
            id = UUID.randomUUID().toString(),
            phoneNumber = phoneNumber?.takeIf { it.isNotBlank() },
            startedAt = System.currentTimeMillis(),
        )
        saveSession(context, session)
        return session
    }

    fun getSession(context: Context, id: String): CallSession? =
        loadAll(context).firstOrNull { it.id == id }

    fun saveSession(context: Context, session: CallSession) {
        val all = loadAll(context).toMutableList()
        val index = all.indexOfFirst { it.id == session.id }
        if (index >= 0) {
            all[index] = session
        } else {
            all.add(0, session)
        }
        persist(context, all.take(50))

        CoroutineScope(Dispatchers.IO).launch {
            com.aegisai.app.data.SessionHelper.syncHistoryWithCloud(context)
        }
    }

    fun recentSessions(context: Context, limit: Int = 10): List<CallSession> =
        loadAll(context).take(limit)

    private fun loadAll(context: Context): List<CallSession> {
        val raw = context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SESSIONS, null)
            ?: return emptyList()
        return try {
            adapter.fromJson(raw) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun persist(context: Context, sessions: List<CallSession>) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SESSIONS, adapter.toJson(sessions))
            .apply()
    }
}
