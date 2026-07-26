package com.aegisai.app.call

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.aegisai.app.AegisApp

/**
 * Enables Call Guard without a permanent foreground service.
 * API 29+: relies on [AegisCallScreeningService] when call screening role is granted.
 * API 26–28 (or missing role): registers a lightweight phone-state receiver while enabled.
 */
object CallGuardController {
    private var fallbackReceiver: IncomingCallReceiver? = null

    fun sync(context: Context) {
        if (AegisApp.get(context).prefs.callGuardEnabled) enable(context) else disable(context)
    }

    fun enable(context: Context) {
        val appContext = context.applicationContext
        if (!CallGuardPermissions.canRunCallGuard(appContext)) return

        if (CallScreeningRoleHelper.usePhoneStateFallback(appContext)) {
            registerFallbackReceiver(appContext)
        } else {
            unregisterFallbackReceiver(appContext)
        }
    }

    fun disable(context: Context) {
        val appContext = context.applicationContext
        unregisterFallbackReceiver(appContext)
        CallSessionTracker.stop(appContext)
    }

    fun isFullyConfigured(context: Context): Boolean {
        if (!CallGuardPermissions.canRunCallGuard(context)) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return CallScreeningRoleHelper.holdsRole(context)
        }
        return true
    }

    private fun registerFallbackReceiver(appContext: Context) {
        if (ContextCompat.checkSelfPermission(appContext, android.Manifest.permission.READ_PHONE_STATE)
            != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        if (fallbackReceiver != null) return
        fallbackReceiver = IncomingCallReceiver()
        val filter = IntentFilter(TelephonyManager.ACTION_PHONE_STATE_CHANGED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(fallbackReceiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            appContext.registerReceiver(fallbackReceiver, filter)
        }
    }

    private fun unregisterFallbackReceiver(appContext: Context) {
        fallbackReceiver?.let {
            try {
                appContext.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) { }
        }
        fallbackReceiver = null
    }
}
