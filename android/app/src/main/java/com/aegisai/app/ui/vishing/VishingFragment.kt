package com.aegisai.app.ui.vishing

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.aegisai.app.AegisApp
import com.aegisai.app.R
import com.aegisai.app.call.CallAnalysisNotifier
import com.aegisai.app.call.CallGuardController
import com.aegisai.app.call.CallGuardPermissions
import com.aegisai.app.call.CallScreeningRoleHelper
import com.aegisai.app.call.CallSession
import com.aegisai.app.call.CallSessionStore
import com.aegisai.app.data.ApiClient
import com.aegisai.app.data.ScanResult
import com.aegisai.app.databinding.FragmentVishingBinding
import com.aegisai.app.ui.call.CallAnalysisResultActivity
import com.aegisai.app.util.AnimUtil
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.graphics.Typeface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class VishingFragment : Fragment() {
    private var _binding: FragmentVishingBinding? = null
    private val binding get() = _binding!!
    private lateinit var api: ApiClient
    private var recorder: MediaRecorder? = null
    private var recordingFile: File? = null

    private val micPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startRecording() else Toast.makeText(requireContext(), "Microphone permission required", Toast.LENGTH_LONG).show()
    }

    private val callGuardPermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (!isAdded || _binding == null) return@registerForActivityResult
        if (results.values.all { it }) {
            requestCallScreeningRoleIfNeeded()
        } else {
            binding.callGuardSwitch.isChecked = false
            Toast.makeText(requireContext(), R.string.call_guard_need_permissions, Toast.LENGTH_LONG).show()
        }
    }

    private val callScreeningRole = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if (!isAdded || _binding == null) return@registerForActivityResult
        finalizeCallGuardEnable()
    }

    private val audioPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri == null) return@registerForActivityResult
        
        val ctx = requireContext().applicationContext
        val contentResolver = ctx.contentResolver
        val cacheDir = ctx.cacheDir
        
        var fileName = "manual_upload_${System.currentTimeMillis()}.audio"
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (nameIndex != -1 && cursor.moveToFirst()) {
                val n = cursor.getString(nameIndex)
                if (!n.isNullOrBlank()) fileName = n
            }
        }

        Toast.makeText(ctx, "Uploading and analyzing audio...", Toast.LENGTH_LONG).show()

        runJob {
            val file = File(cacheDir, fileName)
            contentResolver.openInputStream(uri)?.use { input ->
                file.outputStream().use { output ->
                    input.copyTo(output)
                }
            }
            if (!file.exists() || file.length() == 0L) {
                throw Exception("Could not read selected file")
            }
            api.scanAudio(file)
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentVishingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        api = ApiClient(AegisApp.get(requireContext()).prefs.apiBaseUrl)
        val prefs = AegisApp.get(requireContext()).prefs

        AnimUtil.fadeInUp(binding.callGuardCard)
        binding.callGuardSwitch.isChecked = prefs.callGuardEnabled
        binding.callGuardSwitch.setOnCheckedChangeListener { _, checked ->
            if (checked) enableCallGuard() else disableCallGuard()
        }

        binding.analyzeTranscriptBtn.setOnClickListener {
            AnimUtil.pulse(binding.analyzeTranscriptBtn)
            val t = binding.transcriptInput.text?.toString()?.trim().orEmpty()
            if (t.length < 3) {
                Toast.makeText(requireContext(), "Transcript too short", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val phone = binding.phoneInput.text?.toString()?.trim()
            runJob { api.analyzeVishingTranscript(t, phone) }
        }

        binding.recordBtn.setOnClickListener {
            if (ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                startRecording()
            } else {
                micPermission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }

        binding.stopRecordBtn.setOnClickListener { stopAndScan() }

        binding.uploadAudioBtn.setOnClickListener {
            audioPicker.launch("audio/*")
        }

        handleSessionDeepLink()
        refreshCallGuardStatus()
        refreshCallHistory()
    }

    override fun onResume() {
        super.onResume()
        refreshCallGuardStatus()
        refreshCallHistory()
    }

    private fun handleSessionDeepLink() {
        val sessionId = activity?.intent?.getStringExtra(CallAnalysisNotifier.EXTRA_SESSION_ID)
            ?: return
        activity?.intent?.removeExtra(CallAnalysisNotifier.EXTRA_SESSION_ID)
        startActivity(CallAnalysisResultActivity.intent(requireContext(), sessionId))
    }

    private fun enableCallGuard() {
        val missing = CallGuardPermissions.requiredPermissions().filter {
            ContextCompat.checkSelfPermission(requireContext(), it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            requestCallScreeningRoleIfNeeded()
        } else {
            binding.callGuardSwitch.isChecked = false
            callGuardPermissions.launch(missing.toTypedArray())
        }
    }

    private fun requestCallScreeningRoleIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            CallScreeningRoleHelper.isRoleAvailable(requireContext()) &&
            !CallScreeningRoleHelper.holdsRole(requireContext())
        ) {
            CallScreeningRoleHelper.createRequestIntent(requireContext())?.let { intent ->
                callScreeningRole.launch(intent)
                return
            }
        }
        finalizeCallGuardEnable()
    }

    private fun finalizeCallGuardEnable() {
        val ctx = requireContext().applicationContext
        val prefs = AegisApp.get(ctx).prefs
        prefs.callGuardEnabled = true
        CallGuardController.enable(ctx)
        binding.callGuardSwitch.isChecked = true
        refreshCallGuardStatus()
        Toast.makeText(requireContext(), R.string.call_guard_enabled, Toast.LENGTH_LONG).show()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            CallScreeningRoleHelper.isRoleAvailable(requireContext()) &&
            CallScreeningRoleHelper.holdsRole(requireContext())
        ) {
            Toast.makeText(requireContext(), R.string.call_guard_role_granted, Toast.LENGTH_SHORT).show()
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            CallScreeningRoleHelper.isRoleAvailable(requireContext())
        ) {
            Toast.makeText(requireContext(), R.string.call_guard_need_role, Toast.LENGTH_LONG).show()
        }
    }

    private fun disableCallGuard() {
        val ctx = requireContext().applicationContext
        AegisApp.get(ctx).prefs.callGuardEnabled = false
        CallGuardController.disable(ctx)
        refreshCallGuardStatus()
        Toast.makeText(requireContext(), "Call Guard disabled", Toast.LENGTH_SHORT).show()
    }

    private fun refreshCallGuardStatus() {
        if (_binding == null) return
        val configured = CallGuardController.isFullyConfigured(requireContext())
        binding.callGuardStatus.isVisible = binding.callGuardSwitch.isChecked
        binding.callGuardStatus.text = when {
            !binding.callGuardSwitch.isChecked -> ""
            configured -> getString(R.string.call_guard_enabled)
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                CallScreeningRoleHelper.isRoleAvailable(requireContext()) ->
                getString(R.string.call_guard_need_role)
            else -> getString(R.string.call_guard_enabled)
        }
    }

    private var recentSessions: List<CallSession> = emptyList()

    private fun refreshCallHistory() {
        if (_binding == null) return
        val sessions = CallSessionStore.recentSessions(requireContext(), 5)
        recentSessions = sessions
        if (sessions.isEmpty()) {
            binding.callHistoryCard.isVisible = false
            return
        }
        binding.callHistoryCard.isVisible = true

        val ssb = SpannableStringBuilder()
        sessions.forEachIndexed { index, session ->
            appendFormattedCallSession(ssb, session)
            if (index < sessions.size - 1) {
                ssb.append("\n\n")
                ssb.append("─".repeat(30))
                ssb.append("\n\n")
            }
        }
        binding.callHistoryList.text = ssb
        binding.callHistoryList.setOnClickListener { openCallHistoryPicker() }
        binding.callHistoryCard.setOnClickListener { openCallHistoryPicker() }
    }

    private fun appendFormattedCallSession(ssb: SpannableStringBuilder, session: CallSession) {
        val time = session.endedAt ?: session.startedAt
        val formattedTime = android.text.format.DateFormat.format("MMM d, HH:mm", time).toString()

        // Time + Phone number line
        val headerStart = ssb.length
        ssb.append("[$formattedTime] ")
        ssb.append("Phone: ${session.phoneNumber ?: "Unknown"}")
        ssb.setSpan(StyleSpan(Typeface.BOLD), headerStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        ssb.append("\n")

        // Risk line with color
        val risk = session.result?.risk?.uppercase() ?: session.status.uppercase()
        val conf = session.result?.confidence?.let { " (${(it * 100).toInt()}%)" } ?: ""
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
        session.result?.reason?.let { reason ->
            if (reason.isNotBlank()) {
                ssb.append("\n")
                ssb.append(reason)
            }
        }

        // Transcription preview
        val transcription = session.result?.transcription ?: session.errorMessage
        transcription?.let { text ->
            if (text.isNotBlank()) {
                ssb.append("\n")
                val preview = if (text.length > 120) text.take(120) + "…" else text
                val bodyStart = ssb.length
                ssb.append(preview)
                ssb.setSpan(ForegroundColorSpan(0xAA_FFFFFF.toInt()), bodyStart, ssb.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }
    }

    private fun openCallHistoryPicker() {
        if (recentSessions.isEmpty()) return
        if (recentSessions.size == 1) {
            startActivity(CallAnalysisResultActivity.intent(requireContext(), recentSessions[0].id))
            return
        }
        val labels = recentSessions.map { formatHistoryLine(it) }.toTypedArray()
        androidx.appcompat.app.AlertDialog.Builder(requireContext())
            .setTitle(R.string.call_guard_history_pick)
            .setItems(labels) { _, which ->
                startActivity(CallAnalysisResultActivity.intent(requireContext(), recentSessions[which].id))
            }
            .show()
    }

    private fun formatHistoryLine(session: CallSession): String {
        val phone = session.phoneNumber ?: "Unknown"
        val risk = session.result?.risk ?: session.status
        val conf = session.result?.confidence?.let { " (${(it * 100).toInt()}%)" } ?: ""
        val time = session.endedAt ?: session.startedAt
        val formatted = android.text.format.DateFormat.format("MMM d, HH:mm", time)
        return "$formatted · $phone · $risk$conf"
    }

    private fun startRecording() {
        val file = File(requireContext().cacheDir, "vishing_${System.currentTimeMillis()}.m4a")
        recordingFile = file
        try {
            recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(requireContext())
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(16_000)
                setAudioEncodingBitRate(64_000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
        } catch (e: Exception) {
            recorder?.release()
            recorder = null
            recordingFile = null
            Toast.makeText(requireContext(), "Could not start recording: ${e.message}", Toast.LENGTH_LONG).show()
            return
        }
        binding.recordBtn.isEnabled = false
        binding.stopRecordBtn.isVisible = true
        Toast.makeText(requireContext(), "Recording…", Toast.LENGTH_SHORT).show()
    }

    private fun stopAndScan() {
        try {
            recorder?.stop()
        } catch (_: Exception) { }
        recorder?.release()
        recorder = null
        binding.recordBtn.isEnabled = true
        binding.stopRecordBtn.isVisible = false
        val file = recordingFile ?: return
        runJob { api.scanAudio(file) }
    }

    private fun runJob(block: suspend () -> ScanResult) {
        binding.vishingProgress.isVisible = true
        binding.vishingResultCard.isVisible = true
        binding.vishingResult.text = "Uploading and analyzing... This may take up to 2-3 minutes for large files or if the server is waking up."
        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { block() }
                showResult(result)
            } catch (e: Exception) {
                showResult(ScanResult(error = e.message ?: "Unknown error occurred: ${e.javaClass.simpleName}"))
            } finally {
                binding.vishingProgress.isVisible = false
            }
        }
    }

    private fun showResult(result: ScanResult) {
        binding.vishingResultCard.isVisible = true
        if (result.error != null) {
            binding.vishingResult.text = getString(R.string.error_prefix, result.error)
            return
        }
        val conf = ((result.confidence ?: 0.0) * 100).toInt()
        val sb = StringBuilder()
        sb.append(getString(R.string.vishing_risk, result.risk))
        sb.append("\n")
        sb.append(getString(R.string.vishing_confidence, conf))
        sb.append("\n\n")
        sb.append(result.reason)

        result.transcription?.let {
            sb.append("\n\n")
            sb.append(getString(R.string.vishing_transcription_label))
            sb.append("\n")
            sb.append(it)
            binding.transcriptInput.setText(it)
        }
        binding.vishingResult.text = sb.toString()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        recorder?.release()
        _binding = null
    }
}
