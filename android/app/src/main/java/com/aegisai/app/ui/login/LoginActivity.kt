package com.aegisai.app.ui.login

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.net.toUri
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.aegisai.app.AegisApp
import com.aegisai.app.BuildConfig
import com.aegisai.app.databinding.ActivityLoginBinding
import com.aegisai.app.data.SessionHelper
import com.aegisai.app.util.AnimUtil
import com.aegisai.app.util.AuthValidator
import io.github.jan.supabase.gotrue.OtpType
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.net.URLEncoder

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private val app get() = AegisApp.get(this)
    private val prefs get() = app.prefs
    private var isSignUp = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (prefs.isLoggedIn()) {
            lifecycleScope.launch {
                SessionHelper.refreshUserFromToken(this@LoginActivity)
                routeAfterAuth()
            }
            return
        }

        isSignUp = intent.getBooleanExtra(EXTRA_SIGN_UP, false)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        AnimUtil.fadeInUp(binding.loginContent)
        updateModeUi()

        binding.modeToggle.setOnClickListener {
            isSignUp = !isSignUp
            AnimUtil.pulse(binding.loginCard)
            updateModeUi()
        }

        binding.primaryBtn.setOnClickListener {
            AnimUtil.pulse(binding.primaryBtn)
            if (isSignUp) signUpEmail() else signInEmail()
        }
        binding.googleBtn.setOnClickListener {
            AnimUtil.pulse(binding.googleBtn)
            signInGoogleBrowser()
        }

        handleAuthCallback(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleAuthCallback(intent)
    }

    private fun updateModeUi() {
        binding.formTitle.text = if (isSignUp) "Sign up to Aegis" else getString(com.aegisai.app.R.string.sign_in)
        binding.formSubtitle.text = if (isSignUp) {
            getString(com.aegisai.app.R.string.login_signup_subtitle)
        } else {
            getString(com.aegisai.app.R.string.login_signin_subtitle)
        }
        binding.primaryBtn.text = if (isSignUp) "Create account" else getString(com.aegisai.app.R.string.sign_in)
        binding.googleBtn.text = if (isSignUp) {
            getString(com.aegisai.app.R.string.sign_up_google)
        } else {
            getString(com.aegisai.app.R.string.sign_in_google)
        }
        binding.modeToggle.text = if (isSignUp) {
            getString(com.aegisai.app.R.string.login_switch_signin)
        } else {
            getString(com.aegisai.app.R.string.login_switch_signup)
        }
        binding.usernameLayout.isVisible = isSignUp
        binding.confirmPasswordLayout.isVisible = isSignUp
        binding.errorText.isVisible = false
    }

    private fun showError(msg: String) {
        binding.errorText.text = msg
        binding.errorText.isVisible = true
        AnimUtil.shake(binding.errorText)
    }

    private fun signInEmail() {
        val email = binding.emailInput.text?.toString()?.trim().orEmpty()
        val password = binding.passwordInput.text?.toString().orEmpty()
        if (email.isBlank() || password.isBlank()) {
            showError("Enter email and password")
            return
        }

        lifecycleScope.launch {
            try {
                setLoading(loading = true)
                app.supabase.auth.signInWith(Email) {
                    this.email = email
                    this.password = password
                }
                persistSession(email)
                if (!isEmailVerified()) {
                    goVerifyEmail(email, prefs.username)
                } else {
                    SessionHelper.refreshUserFromToken(this@LoginActivity)
                    routeAfterAuth()
                }
            } catch (e: Exception) {
                showError(AuthValidator.mapAuthError(e.message))
            } finally {
                setLoading(false)
            }
        }
    }

    private fun signUpEmail() {
        val username = binding.usernameInput.text?.toString()?.trim().orEmpty()
        val email = binding.emailInput.text?.toString()?.trim().orEmpty().lowercase()
        val password = binding.passwordInput.text?.toString().orEmpty()
        val confirm = binding.confirmPasswordInput.text?.toString().orEmpty()

        val validationError = when {
            username.isBlank() -> "Choose a username"
            !AuthValidator.isGmail(email) -> "Use a Gmail address (@gmail.com)"
            password.length < 8 -> "Password must be at least 8 characters"
            password != confirm -> "Passwords do not match"
            else -> null
        }
        if (validationError != null) {
            showError(validationError)
            return
        }

        lifecycleScope.launch {
            try {
                setLoading(loading = true)
                app.supabase.auth.signUpWith(Email) {
                    this.email = email
                    this.password = password
                    data = buildJsonObject { put("username", username) }
                }
                prefs.username = username
                prefs.email = email
                Toast.makeText(this@LoginActivity, "Check your Gmail for a 6-digit code", Toast.LENGTH_LONG).show()
                goVerifyEmail(email, username)
            } catch (e: Exception) {
                showError(AuthValidator.mapAuthError(e.message))
            } finally {
                setLoading(false)
            }
        }
    }

    private fun signInGoogleBrowser() {
        val redirect = URLEncoder.encode("com.aegisai.app://auth-callback", "UTF-8")
        val url =
            "${BuildConfig.SUPABASE_URL.trimEnd('/')}/auth/v1/authorize?provider=google&redirect_to=$redirect"
        CustomTabsIntent.Builder().build().launchUrl(this, url.toUri())
    }

    private fun handleAuthCallback(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme != "com.aegisai.app" || data.host != "auth-callback") return

        val fragment = data.fragment ?: return
        val params = fragment.split("&").mapNotNull {
            val p = it.split("=")
            if (p.size == 2) p[0] to p[1] else null
        }.toMap()

        val access = params["access_token"]
        val refresh = params["refresh_token"]
        if (access.isNullOrBlank()) {
            showError("Google sign-in failed")
            return
        }

        prefs.accessToken = access
        prefs.refreshToken = refresh

        lifecycleScope.launch {
            setLoading(loading = true)
            SessionHelper.refreshUserFromToken(this@LoginActivity)
            setLoading(loading = false)
            routeAfterAuth()
        }
    }

    private fun persistSession(email: String) {
        val session = app.supabase.auth.currentSessionOrNull()
        prefs.accessToken = session?.accessToken
        prefs.refreshToken = session?.refreshToken
        prefs.email = email
        val meta = app.supabase.auth.currentUserOrNull()?.userMetadata
        prefs.username = meta?.get("username")?.toString()?.takeIf { it.isNotBlank() }
            ?: email.substringBefore("@")
    }

    private suspend fun isEmailVerified(): Boolean {
        val token = prefs.accessToken ?: return false
        val user = SessionHelper.fetchUser(token) ?: return false
        return user.has("email_confirmed_at") && !user.isNull("email_confirmed_at")
    }

    private fun goVerifyEmail(email: String, username: String?) {
        startActivity(
            Intent(this, VerifyEmailActivity::class.java)
                .putExtra(VerifyEmailActivity.EXTRA_EMAIL, email)
                .putExtra(VerifyEmailActivity.EXTRA_USERNAME, username),
        )
        AnimUtil.activityOpen(this)
        finish()
    }

    private fun routeAfterAuth() {
        val next = if (prefs.needsPhoneVerification()) {
            Intent(this, VerifyPhoneActivity::class.java)
        } else {
            Intent(this, com.aegisai.app.ui.main.MainActivity::class.java)
        }
        startActivity(next)
        AnimUtil.activityOpen(this)
        finish()
    }

    private fun setLoading(loading: Boolean) {
        binding.primaryBtn.isEnabled = !loading
        binding.googleBtn.isEnabled = !loading
        binding.primaryBtn.text = when {
            loading -> "Please wait…"
            isSignUp -> "Create account"
            else -> getString(com.aegisai.app.R.string.sign_in)
        }
    }

    companion object {
        const val EXTRA_SIGN_UP = "extra_sign_up"
    }
}
