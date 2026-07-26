package com.aegisai.app.ui.login

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import com.aegisai.app.AegisApp
import com.aegisai.app.data.ApiClient
import com.aegisai.app.databinding.ActivityVerifyPhoneBinding
import com.aegisai.app.ui.main.MainActivity
import com.aegisai.app.util.AnimUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class VerifyPhoneActivity : AppCompatActivity() {
    private lateinit var binding: ActivityVerifyPhoneBinding
    private val prefs get() = AegisApp.get(this).prefs
    private var otpSent = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!prefs.isLoggedIn()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        binding = ActivityVerifyPhoneBinding.inflate(layoutInflater)
        setContentView(binding.root)
        AnimUtil.fadeInUp(binding.root)

        binding.sendOtpBtn.setOnClickListener { sendOtp() }
        binding.verifyPhoneBtn.setOnClickListener { verifyOtp() }
        binding.skipPhoneBtn.setOnClickListener { skipAndGoMain() }
    }

    private fun normalizePhone(raw: String): String {
        var p = raw.trim().replace(" ", "").replace("-", "")
        if (p.startsWith("+")) return p
        if (p.length == 10) return "+91$p"
        if (p.startsWith("91") && p.length == 12) return "+$p"
        return p
    }

    private fun sendOtp() {
        val phone = normalizePhone(binding.phoneInput.text?.toString().orEmpty())
        if (phone.length < 10) {
            Toast.makeText(this, "Enter a valid mobile number", Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch {
            try {
                binding.sendOtpBtn.isEnabled = false
                val api = ApiClient(prefs.apiBaseUrl)
                val res = withContext(Dispatchers.IO) {
                    api.sendPhoneOtp(phone, prefs.email)
                }
                if (res.error != null) {
                    Toast.makeText(this@VerifyPhoneActivity, res.error, Toast.LENGTH_LONG).show()
                    return@launch
                }
                otpSent = true
                prefs.phone = phone
                binding.otpLayout.isVisible = true
                binding.verifyPhoneBtn.isVisible = true
                res.dev_otp?.let {
                    Toast.makeText(this@VerifyPhoneActivity, "Dev OTP: $it", Toast.LENGTH_LONG).show()
                } ?: Toast.makeText(this@VerifyPhoneActivity, "OTP sent", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this@VerifyPhoneActivity, e.message ?: "Failed to send OTP", Toast.LENGTH_LONG).show()
            } finally {
                binding.sendOtpBtn.isEnabled = true
            }
        }
    }

    private fun verifyOtp() {
        val phone = prefs.phone ?: normalizePhone(binding.phoneInput.text?.toString().orEmpty())
        val otp = binding.phoneOtpInput.text?.toString()?.trim().orEmpty()
        if (!otpSent || otp.length != 6) {
            Toast.makeText(this, "Enter the 6-digit OTP", Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch {
            try {
                binding.verifyPhoneBtn.isEnabled = false
                val api = ApiClient(prefs.apiBaseUrl)
                val res = withContext(Dispatchers.IO) {
                    api.verifyPhoneOtp(phone, otp, prefs.email)
                }
                if (res.error != null || !res.ok) {
                    Toast.makeText(this@VerifyPhoneActivity, res.error ?: res.message, Toast.LENGTH_LONG).show()
                    return@launch
                }
                prefs.phone = phone
                prefs.phoneVerified = true
                prefs.phoneVerificationSkipped = false
                Toast.makeText(this@VerifyPhoneActivity, "Mobile verified", Toast.LENGTH_SHORT).show()
                try {
                    SessionHelper.syncHistoryWithCloud(this@VerifyPhoneActivity)
                } catch (_: Exception) {}
                goMain()
            } catch (e: Exception) {
                Toast.makeText(this@VerifyPhoneActivity, e.message ?: "Verification failed", Toast.LENGTH_LONG).show()
            } finally {
                binding.verifyPhoneBtn.isEnabled = true
            }
        }
    }

    private fun skipAndGoMain() {
        prefs.phoneVerificationSkipped = true
        Toast.makeText(this, "You can verify your number later in Profile", Toast.LENGTH_SHORT).show()
        goMain()
    }

    private fun goMain() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        AnimUtil.activityOpen(this)
        finish()
    }
}
