package com.aegisai.app.ui.email

import android.os.Bundle
import android.preference.PreferenceManager
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.aegisai.app.AegisApp
import com.aegisai.app.R
import com.aegisai.app.data.ApiClient
import com.aegisai.app.data.GmailEmail
import com.aegisai.app.data.ScanResult
import com.aegisai.app.databinding.FragmentEmailBinding
import com.aegisai.app.databinding.ItemEmailFetchBinding
import com.aegisai.app.util.AnimUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class EmailFragment : Fragment() {
    private var _binding: FragmentEmailBinding? = null
    private val binding get() = _binding!!
    private lateinit var api: ApiClient

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentEmailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        api = ApiClient(AegisApp.get(requireContext()).prefs.apiBaseUrl)

        AnimUtil.fadeInUp(binding.credentialsCard)
        AnimUtil.fadeInUp(binding.emailInboxCard)

        // Load saved credentials from DefaultSharedPreferences
        val sharedPrefs = PreferenceManager.getDefaultSharedPreferences(requireContext())
        binding.emailAddressInput.setText(sharedPrefs.getString("saved_gmail_address", ""))
        binding.emailAppPasswordInput.setText(sharedPrefs.getString("saved_gmail_app_password", ""))

        binding.emailFetchBtn.setOnClickListener {
            val email = binding.emailAddressInput.text?.toString()?.trim().orEmpty()
            val password = binding.emailAppPasswordInput.text?.toString()?.trim().orEmpty()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(requireContext(), R.string.email_empty_fields, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Save credentials for convenience
            sharedPrefs.edit()
                .putString("saved_gmail_address", email)
                .putString("saved_gmail_app_password", password)
                .apply()

            fetchEmails(email, password)
        }
    }

    private fun fetchEmails(email: String, appPassword: String) {
        binding.emailProgress.isVisible = true
        binding.emailFetchBtn.isEnabled = false
        binding.emailListContainer.removeAllViews()
        binding.emailNoHistory.isVisible = false

        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    api.fetchGmailEmails(email, appPassword)
                }
                if (_binding == null) return@launch

                binding.emailProgress.isVisible = false
                binding.emailFetchBtn.isEnabled = true

                if (response.error != null) {
                    binding.emailNoHistory.isVisible = true
                    binding.emailNoHistory.text = response.error
                } else {
                    val emails = response.emails.orEmpty()
                    if (emails.isEmpty()) {
                        binding.emailNoHistory.isVisible = true
                        binding.emailNoHistory.setText(R.string.email_no_history)
                    } else {
                        binding.emailNoHistory.isVisible = false
                        emails.forEach { gmail ->
                            addEmailItemView(gmail)
                        }
                    }
                }
            } catch (e: Exception) {
                if (_binding == null) return@launch
                binding.emailProgress.isVisible = false
                binding.emailFetchBtn.isEnabled = true
                binding.emailNoHistory.isVisible = true
                binding.emailNoHistory.text = getString(R.string.error_prefix, e.message ?: "Unknown network error")
            }
        }
    }

    private fun addEmailItemView(email: GmailEmail) {
        val itemBinding = ItemEmailFetchBinding.inflate(layoutInflater, binding.emailListContainer, false)
        itemBinding.itemEmailFrom.text = "From: " + (email.from ?: "Unknown Sender")
        itemBinding.itemEmailSubject.text = "Subject: " + (email.subject ?: "No Subject")
        itemBinding.itemEmailBody.text = email.body ?: "No preview available"

        itemBinding.itemEmailScanBtn.setOnClickListener {
            scanEmailItem(email, itemBinding)
        }

        binding.emailListContainer.addView(itemBinding.root)
    }

    private fun scanEmailItem(email: GmailEmail, itemBinding: ItemEmailFetchBinding) {
        itemBinding.itemEmailScanBtn.isVisible = false
        itemBinding.itemEmailProgress.isVisible = true

        lifecycleScope.launch {
            try {
                val fullText = "Subject: ${email.subject.orEmpty()}\n\n${email.body.orEmpty()}"
                val result = withContext(Dispatchers.IO) {
                    api.scanText(fullText, email.from)
                }

                if (_binding == null) return@launch
                itemBinding.itemEmailProgress.isVisible = false
                displayScanResult(result, itemBinding)

            } catch (e: Exception) {
                if (_binding == null) return@launch
                itemBinding.itemEmailProgress.isVisible = false
                itemBinding.itemEmailScanBtn.isVisible = true
                Toast.makeText(requireContext(), "Scan failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun displayScanResult(result: ScanResult, itemBinding: ItemEmailFetchBinding) {
        itemBinding.itemEmailResultLayout.isVisible = true
        itemBinding.itemEmailDivider.isVisible = true

        val risk = result.risk?.uppercase() ?: "UNKNOWN"
        val conf = result.confidence?.let { " (${(it * 100).toInt()}%)" } ?: ""

        itemBinding.itemEmailRisk.text = getString(R.string.email_risk, risk)
        itemBinding.itemEmailConfidence.text = conf

        val riskColor = when (risk) {
            "SCAM", "PHISHING", "HIGH" -> 0xFFEF4444.toInt() // Red
            "SAFE", "LOW" -> 0xFF10B981.toInt() // Green
            else -> 0xFFFBBF24.toInt() // Yellow/amber
        }
        itemBinding.itemEmailRisk.setTextColor(riskColor)
        itemBinding.itemEmailReason.text = getString(R.string.email_reason_prefix, result.reason ?: "No detailed reason provided.")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
