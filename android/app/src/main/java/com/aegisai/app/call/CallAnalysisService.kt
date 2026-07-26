package com.aegisai.app.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.aegisai.app.AegisApp
import com.aegisai.app.R
import com.aegisai.app.data.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Short-lived foreground service — runs only during recording discovery and upload.
 * No idle battery drain; started when a call ends or user picks a file manually.
 */
class CallAnalysisService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val sessionId = intent?.getStringExtra(EXTRA_SESSION_ID)
        if (sessionId.isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        synchronized(runningSessions) {
            if (runningSessions.contains(sessionId)) {
                Log.w(TAG, "Session $sessionId is already running/analyzing. Ignoring duplicate start command.")
                return START_NOT_STICKY
            }
            runningSessions.add(sessionId)
        }

        when (intent.action) {
            ACTION_DISCOVER_AND_ANALYZE -> {
                promoteForeground(
                    getString(R.string.call_guard_discovering_title),
                    getString(R.string.call_guard_discovering_body),
                )
                scope.launch { discoverAndAnalyze(sessionId) }
            }
            ACTION_ANALYZE_URI -> {
                promoteForeground(
                    getString(R.string.call_guard_analyzing_title),
                    getString(R.string.call_guard_analyzing_body),
                )
                scope.launch { analyzeSession(sessionId) }
            }
            else -> {
                synchronized(runningSessions) {
                    runningSessions.remove(sessionId)
                }
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private suspend fun discoverAndAnalyze(sessionId: String) {
        val appContext = applicationContext
        try {
            val session = CallSessionStore.getSession(appContext, sessionId)
            if (session == null) {
                Log.w(TAG, "Session $sessionId missing for discovery")
                return finish(sessionId)
            }

            val prefs = AegisApp.get(appContext).prefs
            if (!prefs.callGuardEnabled) {
                markFailed(appContext, session, "Call Guard is disabled.")
                return finish(sessionId)
            }

            val startedAtMs = session.startedAt
            val endedAtMs = session.endedAt ?: System.currentTimeMillis()
            val windowMs = prefs.callGuardDiscoveryWindowMs
            val pollIntervalMs = 3_000L
            val maxAttempts = (windowMs / pollIntervalMs).toInt().coerceAtLeast(1)

            val learnedPath = prefs.learnedRecordingPath
            val learnedExt = prefs.learnedRecordingExtension

            var found = DialerRecordingFinder.findBestMatchDetailed(
                context = appContext,
                startedAtMs = startedAtMs,
                endedAtMs = endedAtMs,
                learnedPath = learnedPath,
                learnedExt = learnedExt
            )
            var attempt = 0
            while (found == null && attempt < maxAttempts) {
                delay(pollIntervalMs)
                found = DialerRecordingFinder.findBestMatchDetailed(
                    context = appContext,
                    startedAtMs = startedAtMs,
                    endedAtMs = endedAtMs,
                    learnedPath = learnedPath,
                    learnedExt = learnedExt
                )
                attempt++
                withContext(Dispatchers.Main) {
                    promoteForeground(
                        getString(R.string.call_guard_discovering_title),
                        getString(R.string.call_guard_discovering_progress, attempt + 1, maxAttempts),
                    )
                }
            }

            if (found == null) {
                val failed = session.copy(
                    status = CallSession.STATUS_NO_RECORDING,
                    endedAt = session.endedAt ?: System.currentTimeMillis(),
                    errorMessage = "No dialer recording found. Tap below to select the file manually.",
                )
                CallSessionStore.saveSession(appContext, failed)
                CallAnalysisNotifier.showNoRecordingFound(appContext, failed)
                CallAnalysisNotifier.openResultActivity(appContext, sessionId)
                return finish(sessionId)
            }

            // Temporarily store path/extension details of the candidate for potential learning
            val ext = found.displayName.substringAfterLast('.', "").lowercase()
            pendingLearnedData[sessionId] = Pair(found.pathHint, ext)

            val withRecording = session.copy(
                recordingUri = found.uri.toString(),
                recordingDisplayName = found.displayName,
                detectionMethod = CallSession.DETECTION_AUTO,
                status = CallSession.STATUS_ANALYZING,
                endedAt = session.endedAt ?: System.currentTimeMillis(),
            )
            CallSessionStore.saveSession(appContext, withRecording)
            CallAnalysisNotifier.showAnalyzingProgress(appContext, withRecording.phoneNumber, sessionId)
            analyzeSession(sessionId)
        } catch (e: Exception) {
            Log.e(TAG, "Discovery failed for $sessionId", e)
            CallSessionStore.getSession(appContext, sessionId)?.let { session ->
                markFailed(appContext, session, "Recording scan failed: ${e.message ?: "unknown error"}")
            }
            finish(sessionId)
        }
    }

    private suspend fun analyzeSession(sessionId: String) {
        val appContext = applicationContext
        val session = CallSessionStore.getSession(appContext, sessionId)
        if (session == null) {
            return finish(sessionId)
        }

        val uriString = session.recordingUri
        if (uriString.isNullOrBlank()) {
            markFailed(appContext, session, "No recording file attached.")
            return finish(sessionId)
        }

        CallSessionStore.saveSession(
            appContext,
            session.copy(status = CallSession.STATUS_ANALYZING),
        )

        withContext(Dispatchers.Main) {
            promoteForeground(
                getString(R.string.call_guard_analyzing_title),
                getString(R.string.call_guard_analyzing_body),
            )
        }

        val uri = android.net.Uri.parse(uriString)
        waitUntilFileStable(appContext, uri)
        
        val cacheFile = AudioFileHelper.copyUriToCache(appContext, uri)
        if (cacheFile == null || cacheFile.length() < MIN_BYTES) {
            markFailed(appContext, session, "Could not read the recording file.")
            return finish(sessionId)
        }
        if (cacheFile.length() > MAX_BYTES) {
            markFailed(appContext, session, "Recording is too large to analyze.")
            cacheFile.delete()
            return finish(sessionId)
        }

        try {
            val api = ApiClient(AegisApp.get(appContext).prefs.apiBaseUrl)
            val result = api.analyzeCallRecording(cacheFile, session.phoneNumber)
            val done = session.copy(
                status = if (result.error != null) CallSession.STATUS_FAILED else CallSession.STATUS_DONE,
                result = result,
                errorMessage = result.error,
                endedAt = session.endedAt ?: System.currentTimeMillis(),
            )
            CallSessionStore.saveSession(appContext, done)

            if (result.error == null) {
                pendingLearnedData[sessionId]?.let { pair ->
                    val path = pair.first
                    val ext = pair.second
                    val prefs = AegisApp.get(appContext).prefs
                    prefs.learnedRecordingPath = path
                    prefs.learnedRecordingExtension = ext
                    Log.i(TAG, "Learned device behavior: path=$path, ext=$ext")
                }
            }

            if (result.error != null) {
                CallAnalysisNotifier.showError(appContext, session.phoneNumber, result.error, sessionId)
            } else {
                CallAnalysisNotifier.showResult(appContext, done)
            }
            CallAnalysisNotifier.openResultActivity(appContext, sessionId)
        } catch (e: Exception) {
            markFailed(appContext, session, ApiClient.friendlyError(e), sessionId)
        } finally {
            pendingLearnedData.remove(sessionId)
            cacheFile?.delete()
            finish(sessionId)
        }
    }

    private fun markFailed(
        context: Context,
        session: CallSession,
        message: String,
        sessionId: String = session.id,
    ) {
        val failed = session.copy(
            status = CallSession.STATUS_FAILED,
            errorMessage = message,
            endedAt = session.endedAt ?: System.currentTimeMillis(),
        )
        CallSessionStore.saveSession(context, failed)
        CallAnalysisNotifier.showError(context, session.phoneNumber, message, sessionId)
        CallAnalysisNotifier.openResultActivity(context, sessionId)
    }

    private fun promoteForeground(title: String, body: String) {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(title, body),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
    }

    private fun buildNotification(title: String, text: String): Notification {
        ensureChannel()
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_shield)
            .setOngoing(true)
            .setProgress(0, 0, true)
            .build()
    }

    private fun ensureChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.call_guard_channel_analysis),
            NotificationManager.IMPORTANCE_LOW,
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun finish(sessionId: String) {
        synchronized(runningSessions) {
            runningSessions.remove(sessionId)
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private suspend fun waitUntilFileStable(context: Context, uri: android.net.Uri) {
        var lastSize = -1L
        var stableChecks = 0
        for (i in 0 until 10) {
            val currentSize = try {
                context.contentResolver.openFileDescriptor(uri, "r")?.use { it.statSize } ?: -1L
            } catch (e: Exception) {
                -1L
            }
            if (currentSize > 0 && currentSize == lastSize) {
                stableChecks++
                if (stableChecks >= 2) return
            } else {
                stableChecks = 0
            }
            lastSize = currentSize
            delay(1000L)
        }
    }

    companion object {
        private const val TAG = "CallAnalysisService"

        const val ACTION_DISCOVER_AND_ANALYZE = "com.aegisai.app.call.DISCOVER_AND_ANALYZE"
        const val ACTION_ANALYZE_URI = "com.aegisai.app.call.ANALYZE_URI"
        const val EXTRA_SESSION_ID = "session_id"
        private const val CHANNEL_ID = "call_guard_analysis"
        private const val NOTIFICATION_ID = 4201
        private const val MIN_BYTES = 4_000L
        private const val MAX_BYTES = 12 * 1024 * 1024L

        private val runningSessions = mutableSetOf<String>()
        private val pendingLearnedData = mutableMapOf<String, Pair<String, String>>()

        fun isRunning(sessionId: String): Boolean = runningSessions.contains(sessionId)
    }
}

