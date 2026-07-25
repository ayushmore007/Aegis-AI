package com.aegisai.app.sms

import android.content.Context
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import java.util.UUID

object SmsStore {
    private const val PREFS = "sms_records"
    private const val KEY_RECORDS = "records_json"

    private val moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    private val listType = Types.newParameterizedType(List::class.java, SmsRecord::class.java)
    private val adapter = moshi.adapter<List<SmsRecord>>(listType)

    fun createRecord(context: Context, sender: String, body: String): SmsRecord {
        val record = SmsRecord(
            id = UUID.randomUUID().toString(),
            sender = sender,
            body = body,
            timestamp = System.currentTimeMillis()
        )
        saveRecord(context, record)
        return record
    }

    fun saveRecord(context: Context, record: SmsRecord) {
        val all = loadAll(context).toMutableList()
        val index = all.indexOfFirst { it.id == record.id }
        if (index >= 0) {
            all[index] = record
        } else {
            all.add(0, record)
        }
        persist(context, all.take(50)) // Keep last 50 SMS

        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            com.aegisai.app.data.SessionHelper.syncHistoryWithCloud(context)
        }
    }

    fun recentRecords(context: Context, limit: Int = 10): List<SmsRecord> =
        loadAll(context).take(limit)

    private fun loadAll(context: Context): List<SmsRecord> {
        val raw = context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_RECORDS, null)
            ?: return emptyList()
        return try {
            adapter.fromJson(raw) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun persist(context: Context, records: List<SmsRecord>) {
        context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_RECORDS, adapter.toJson(records))
            .apply()
    }
}
