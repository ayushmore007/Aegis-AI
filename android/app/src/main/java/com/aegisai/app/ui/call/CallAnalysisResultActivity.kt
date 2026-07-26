package com.aegisai.app.ui.call

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.aegisai.app.AegisApp
import com.aegisai.app.call.CallAnalysisNotifier
import com.aegisai.app.call.CallAnalysisService
import com.aegisai.app.call.CallGuardCoordinator
import com.aegisai.app.call.CallSession
import com.aegisai.app.call.CallSessionStore
import com.aegisai.app.databinding.ActivityCallAnalysisResultBinding
import android.telephony.TelephonyManager
import android.os.Build

class CallAnalysisResultActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCallAnalysisResultBinding
    private var sessionId: String? = null
    private var staleRecoveryAttempted = false
    private val refreshHandler = Handler(Looper.getMainLooper())
    private val refreshRunnable = object : Runnable {
        override fun run() {
            renderSession()
            if (shouldKeepPolling()) {
                refreshHandler.postDelayed(this, 1500L)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCallAnalysisResultBinding.inflate(layoutInflater)
        setContentView(binding.root)

        sessionId = intent.getStringExtra(CallAnalysisNotifier.EXTRA_SESSION_ID)
            ?: intent.getStringExtra(EXTRA_SESSION_ID)

        binding.pickRecordingBtn.setOnClickListener {
            sessionId?.let { id ->
                startActivity(CallRecordingPickerActivity.intent(this, id))
            }
        }
        binding.retryDiscoveryBtn.setOnClickListener {
            sessionId?.let { id ->
                staleRecoveryAttempted = false
                CallGuardCoordinator.retryDiscovery(this, id)
                renderSession()
                refreshHandler.removeCallbacks(refreshRunnable)
                refreshHandler.postDelayed(refreshRunnable, 1500L)
            }
        }

        sessionId?.let { CallGuardCoordinator.ensureDiscoveryRunning(this, it) }
        renderSession()
    }

    override fun onResume() {
        super.onResume()
        sessionId?.let { CallGuardCoordinator.ensureDiscoveryRunning(this, it) }
        renderSession()
        refreshHandler.removeCallbacks(refreshRunnable)
        if (shouldKeepPolling()) {
            refreshHandler.postDelayed(refreshRunnable, 1500L)
        }
    }

    override fun onPause() {
        refreshHandler.removeCallbacks(refreshRunnable)
        super.onPause()
    }

    private fun shouldKeepPolling(): Boolean {
        val id = sessionId ?: return false
        val session = resolveSession(id) ?: return false
        return session.status in listOf(
            CallSession.STATUS_ACTIVE,
            CallSession.STATUS_DISCOVERING,
            CallSession.STATUS_ANALYZING,
        )
    }

    private fun resolveSession(id: String): CallSession? {
        val session = CallSessionStore.getSession(this, id) ?: return null
        return recoverIfStale(session)
    }

    /** Unstick sessions when the background service was killed mid-discovery or call tracking was interrupted. */
    private fun recoverIfStale(session: CallSession): CallSession {
        if (session.status == CallSession.STATUS_ACTIVE) {
            val tm = getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val phoneIdle = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try { tm.callState == TelephonyManager.CALL_STATE_IDLE } catch (_: Exception) { true }
            } else {
                @Suppress("DEPRECATION")
                tm.callState == TelephonyManager.CALL_STATE_IDLE
            }
            val elapsed = System.currentTimeMillis() - session.startedAt
            if ((phoneIdle && elapsed > 5 * 60 * 1000L) || elapsed > 30 * 60 * 1000L) {
                val updated = session.copy(
                    status = CallSession.STATUS_FAILED,
                    endedAt = System.currentTimeMillis(),
                    errorMessage = "Call tracker was interrupted. Try picking the recording manually.",
                )
                CallSessionStore.saveSession(this, updated)
                return updated
            }
        }

        if (session.status != CallSession.STATUS_DISCOVERING &&
            session.status != CallSession.STATUS_ANALYZING
        ) {
            return session
        }

        val prefs = AegisApp.get(this).prefs
        val anchor = session.endedAt ?: session.startedAt
        val elapsed = System.currentTimeMillis() - anchor
        val discoveryLimit = prefs.callGuardDiscoveryWindowMs + 20_000L
        val analysisLimit = discoveryLimit + 660_000L // ~11 min for upload + transcribe

        if (session.status == CallSession.STATUS_DISCOVERING) {
            if (elapsed > 15_000L && !CallAnalysisService.isRunning(session.id)) {
                CallGuardCoordinator.ensureDiscoveryRunning(this, session.id)
            }
            if (elapsed > discoveryLimit) {
                if (!staleRecoveryAttempted) {
                    staleRecoveryAttempted = true
                    CallGuardCoordinator.retryDiscovery(this, session.id)
                    return CallSessionStore.getSession(this, session.id) ?: session
                }
                val updated = session.copy(
                    status = CallSession.STATUS_NO_RECORDING,
                    errorMessage = "Could not find a dialer recording automatically. Pick the file below or enable call recording in your Phone app.",
                )
                CallSessionStore.saveSession(this, updated)
                return updated
            }
        }

        if (session.status == CallSession.STATUS_ANALYZING && elapsed > analysisLimit) {
            val updated = session.copy(
                status = CallSession.STATUS_FAILED,
                errorMessage = "Analysis timed out. Try a shorter recording or pick the file again.",
            )
            CallSessionStore.saveSession(this, updated)
            return updated
        }

        return session
    }

    private fun renderSession() {
        val id = sessionId ?: run {
            binding.resultBody.text = getString(com.aegisai.app.R.string.call_guard_session_missing)
            return
        }
        val session = resolveSession(id) ?: run {
            binding.resultBody.text = getString(com.aegisai.app.R.string.call_guard_session_missing)
            return
        }

        binding.resultMeta.text = buildString {
            session.phoneNumber?.let { append("From: $it\n") }
            append("Status: ${session.status}\n")
            session.detectionMethod?.let { append("Source: $it\n") }
            session.recordingDisplayName?.let { append("File: $it\n") }
            session.endedAt?.let { append("Ended: ${android.text.format.DateFormat.format("MMM d, HH:mm", it)}") }
        }

        binding.resultBody.text = formatSessionBody(session)

        val discovering = session.status == CallSession.STATUS_DISCOVERING
        val needsManual = session.status == CallSession.STATUS_NO_RECORDING ||
            (session.status == CallSession.STATUS_FAILED && session.recordingUri == null) ||
            discovering

        binding.pickRecordingBtn.isVisible = needsManual
        binding.retryDiscoveryBtn.isVisible =
            session.status == CallSession.STATUS_NO_RECORDING || (discovering && staleRecoveryAttempted)

        binding.resultTitle.text = when (session.status) {
            CallSession.STATUS_DONE -> {
                val risk = session.result?.risk ?: "Result"
                getString(com.aegisai.app.R.string.call_guard_result_title_risk, risk)
            }
            CallSession.STATUS_ACTIVE ->
                getString(com.aegisai.app.R.string.call_guard_result_waiting_call)
            CallSession.STATUS_ANALYZING ->
                getString(com.aegisai.app.R.string.call_guard_result_analyzing)
            CallSession.STATUS_DISCOVERING ->
                getString(com.aegisai.app.R.string.call_guard_result_analyzing)
            CallSession.STATUS_NO_RECORDING ->
                getString(com.aegisai.app.R.string.call_guard_no_recording_title)
            CallSession.STATUS_FAILED ->
                getString(com.aegisai.app.R.string.call_guard_error_title)
            else -> getString(com.aegisai.app.R.string.call_guard_result_title)
        }
    }

    private fun formatSessionBody(session: CallSession): String {
        when (session.status) {
            CallSession.STATUS_ACTIVE ->
                return getString(com.aegisai.app.R.string.call_guard_result_active_hint)
            CallSession.STATUS_DISCOVERING -> {
                val elapsedSec = ((System.currentTimeMillis() - (session.endedAt ?: session.startedAt)) / 1000)
                    .coerceAtLeast(0)
                return buildString {
                    append(getString(com.aegisai.app.R.string.call_guard_discovering_body))
                    append("\n\n")
                    append("Searching (${elapsedSec}s)…")
                    if (CallAnalysisService.isRunning(session.id)) {
                        append("\nBackground scan is running.")
                    } else {
                        append("\nRestarting scan…")
                    }
                    append("\n\nTip: Enable call recording in your Phone app, then use speakerphone during suspicious calls.")
                }
            }
            CallSession.STATUS_ANALYZING ->
                return getString(com.aegisai.app.R.string.call_guard_analyzing_body)
        }
        session.errorMessage?.takeIf { session.result == null }?.let { return it }
        val result = session.result ?: return getString(com.aegisai.app.R.string.call_guard_result_pending)
        if (result.error != null) return result.error

        val conf = result.confidence?.let { (it * 100).toInt() }
        val lang = result.detected_language?.replaceFirstChar {
            if (it.isLowerCase()) it.titlecase() else it.toString()
        }
        return buildString {
            append(getString(com.aegisai.app.R.string.vishing_risk, result.risk ?: "UNKNOWN"))
            append("\n")
            if (conf != null) {
                append(getString(com.aegisai.app.R.string.vishing_confidence, conf))
                append("\n")
            }
            if (!lang.isNullOrBlank()) {
                append("Language: $lang")
                if (result.is_translated == true) append(" (translated for analysis)")
                append("\n\n")
            } else {
                append("\n")
            }
            append(result.reason ?: "")
            result.transcription?.takeIf { it.isNotBlank() }?.let {
                append("\n\n")
                append(getString(com.aegisai.app.R.string.vishing_transcription_label))
                append("\n")
                append(it)
            }
        }
    }

    companion object {
        const val EXTRA_SESSION_ID = CallAnalysisNotifier.EXTRA_SESSION_ID

        fun intent(context: Context, sessionId: String): Intent =
            Intent(context, CallAnalysisResultActivity::class.java).apply {
                putExtra(EXTRA_SESSION_ID, sessionId)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
    }
}
