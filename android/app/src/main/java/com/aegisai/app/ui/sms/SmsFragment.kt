package com.aegisai.app.ui.sms

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.format.DateFormat
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.graphics.Typeface
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.aegisai.app.AegisApp
import com.aegisai.app.R
import com.aegisai.app.data.ApiClient
import com.aegisai.app.data.ScanResult
import com.aegisai.app.databinding.FragmentSmsBinding
import com.aegisai.app.sms.SmsRecord
import com.aegisai.app.sms.SmsStore
import com.aegisai.app.util.AnimUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SmsFragment : Fragment() {
    private var _binding: FragmentSmsBinding? = null
    private val binding get() = _binding!!

    private val smsPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        if (results.values.all { it }) {
            Toast.makeText(requireContext(), "SMS scanning enabled", Toast.LENGTH_SHORT).show()
            updateUiState()
            // Auto-load recent SMS from inbox after permission is granted
            loadInboxAndScan()
        } else {
            Toast.makeText(requireContext(), "Permissions required for SMS scanning", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSmsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val prefs = AegisApp.get(requireContext()).prefs
        val name = prefs.username
        binding.profileBtn.text = if (!name.isNullOrBlank()) name.take(2).uppercase() else "ME"
        binding.profileBtn.setOnClickListener {
            findNavController().navigate(R.id.action_sms_to_profile)
        }
        AnimUtil.fadeInUp(binding.profileBtn)

        AnimUtil.fadeInUp(binding.permissionCard)
        AnimUtil.fadeInUp(binding.smsHistoryCard)

        binding.grantPermissionBtn.setOnClickListener {
            smsPermission.launch(arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS))
        }

        updateUiState()
    }

    override fun onResume() {
        super.onResume()
        updateUiState()
    }

    private var hasLoadedInbox = false

    private fun updateUiState() {
        if (_binding == null) return

        val hasPermissions = ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

        binding.permissionCard.isVisible = !hasPermissions
        binding.smsHistoryCard.isVisible = hasPermissions

        if (hasPermissions) {
            if (!hasLoadedInbox) {
                hasLoadedInbox = true
                loadInboxAndScan()
            }
            refreshHistory()
        }
    }

    /**
     * Read the last 6 SMS from the device inbox and scan any that haven't
     * been scanned yet. This ensures the user sees recent messages right away,
     * even from unknown numbers, without waiting for new SMS to arrive.
     */
    private fun loadInboxAndScan() {
        if (_binding == null) return
        if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) return

        lifecycleScope.launch {
            val inboxMessages = withContext(Dispatchers.IO) {
                readRecentSmsFromInbox(6)
            }

            // Store any messages that aren't already in SmsStore
            val existing = SmsStore.recentRecords(requireContext(), 50)
            val existingBodies = existing.map { it.body.trim() }.toSet()

            var addedNew = false
            for (msg in inboxMessages) {
                if (msg.body.trim() in existingBodies) continue
                val record = SmsStore.createRecord(requireContext(), msg.sender, msg.body)
                // Scan each message asynchronously
                scanRecordInBackground(record)
                addedNew = true
            }

            if (addedNew) {
                refreshHistory()
            }
        }
    }

    private fun scanRecordInBackground(record: SmsRecord) {
        lifecycleScope.launch {
            try {
                val api = ApiClient(AegisApp.get(requireContext()).prefs.apiBaseUrl)
                val result = withContext(Dispatchers.IO) {
                    api.scanText(record.body, record.sender)
                }
                val updated = record.copy(result = result)
                SmsStore.saveRecord(requireContext(), updated)
                if (_binding != null) refreshHistory()
            } catch (e: Exception) {
                val failed = record.copy(result = ScanResult(error = "Scan failed: ${e.message}"))
                SmsStore.saveRecord(requireContext(), failed)
                if (_binding != null) refreshHistory()
            }
        }
    }

    data class InboxMessage(val sender: String, val body: String, val date: Long)

    private fun readRecentSmsFromInbox(limit: Int): List<InboxMessage> {
        val results = mutableListOf<InboxMessage>()
        val ctx = requireContext()
        var cursor: Cursor? = null
        try {
            cursor = ctx.contentResolver.query(
                Uri.parse("content://sms/inbox"),
                arrayOf("address", "body", "date"),
                null, null,
                "date DESC"
            )
            cursor?.let {
                var count = 0
                while (it.moveToNext() && count < limit) {
                    val sender = it.getString(0) ?: "Unknown"
                    val body = it.getString(1) ?: ""
                    val date = it.getLong(2)
                    if (body.isNotBlank()) {
                        results.add(InboxMessage(sender, body, date))
                        count++
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore read errors
        } finally {
            cursor?.close()
        }
        return results
    }

    private fun refreshHistory() {
        if (_binding == null) return
        val records = SmsStore.recentRecords(requireContext(), 10)

        if (records.isEmpty()) {
            binding.smsNoHistory.isVisible = true
            binding.smsHistoryList.isVisible = false
            return
        }

        binding.smsNoHistory.isVisible = false
        binding.smsHistoryList.isVisible = true

        val ssb = SpannableStringBuilder()
        records.forEachIndexed { index, record ->
            appendFormattedRecord(ssb, record)
            if (index < records.size - 1) {
                ssb.append("\n\n")
                ssb.append("─".repeat(30))
                ssb.append("\n\n")
            }
        }
        binding.smsHistoryList.text = ssb
    }

    private fun appendFormattedRecord(ssb: SpannableStringBuilder, record: SmsRecord) {
        val formattedTime = DateFormat.format("MMM d, HH:mm", record.timestamp).toString()

        // Time + sender line
        val headerStart = ssb.length
        ssb.append("[$formattedTime] ")
        ssb.append("From: ${record.sender}")
        ssb.setSpan(StyleSpan(Typeface.BOLD), headerStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        ssb.append("\n")

        // Risk line with color
        val risk = record.result?.risk?.uppercase() ?: "SCANNING..."
        val conf = record.result?.confidence?.let { " (${(it * 100).toInt()}%)" } ?: ""
        val riskStart = ssb.length
        ssb.append("Risk: $risk$conf")
        val riskColor = when (risk) {
            "SCAM", "PHISHING", "HIGH" -> 0xFFEF4444.toInt() // Red
            "SAFE", "LOW" -> 0xFF10B981.toInt() // Green
            else -> 0xFFFBBF24.toInt() // Yellow/amber
        }
        ssb.setSpan(ForegroundColorSpan(riskColor), riskStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        ssb.setSpan(StyleSpan(Typeface.BOLD), riskStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)

        // Reason line
        record.result?.reason?.let { reason ->
            ssb.append("\n")
            ssb.append(reason)
        }

        // Body preview
        ssb.append("\n")
        val bodyPreview = if (record.body.length > 120) record.body.take(120) + "…" else record.body
        val bodyStart = ssb.length
        ssb.append(bodyPreview)
        ssb.setSpan(ForegroundColorSpan(0xAA_FFFFFF.toInt()), bodyStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
