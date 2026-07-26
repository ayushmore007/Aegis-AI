package com.aegisai.app.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.telephony.TelephonyManager
import com.aegisai.app.AegisApp

/**
 * Session-scoped phone state listener — registered only while a call is active.
 * Unregisters on IDLE to avoid idle battery drain.
 */
class CallSessionTracker private constructor(
    private val appContext: Context,
    private val sessionId: String,
) : BroadcastReceiver() {
    private var phase = CallGuardState.PHASE_RINGING
    private var answered = false

    private fun register() {
        val filter = IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(this, filter, Context.RECEIVER_EXPORTED)
        } else {
            appContext.registerReceiver(this, filter)
        }
    }

    private fun unregister() {
        try {
            appContext.unregisterReceiver(this)
        } catch (_: IllegalArgumentException) { }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        if (!AegisApp.get(appContext).prefs.callGuardEnabled) {
            stop(appContext)
            return
        }

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                phase = CallGuardState.PHASE_RINGING
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                phase = CallGuardState.PHASE_OFFHOOK
                answered = true
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                if (answered || phase == CallGuardState.PHASE_OFFHOOK) {
                    CallGuardCoordinator.onCallEnded(appContext, sessionId)
                } else {
                    CallSessionStore.getSession(appContext, sessionId)?.let { session ->
                        CallSessionStore.saveSession(
                            appContext,
                            session.copy(
                                status = CallSession.STATUS_FAILED,
                                endedAt = System.currentTimeMillis(),
                                errorMessage = "Call was not answered — no recording to analyze.",
                            ),
                        )
                    }
                }
                stop(appContext)
            }
        }
    }

    companion object {
        @Volatile
        private var active: CallSessionTracker? = null

        fun start(context: Context, sessionId: String) {
            val appContext = context.applicationContext
            synchronized(this) {
                active?.unregister()
                active = CallSessionTracker(appContext, sessionId).also { it.register() }
            }
        }

        fun stop(context: Context) {
            synchronized(this) {
                active?.unregister()
                active = null
            }
        }
    }
}
