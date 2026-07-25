package com.aegisai.app.ui.scan

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.aegisai.app.R
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.aegisai.app.AegisApp
import com.aegisai.app.data.ApiClient
import com.aegisai.app.databinding.FragmentScanBinding
import com.aegisai.app.util.AnimUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class ScanFragment : Fragment() {
    private var _binding: FragmentScanBinding? = null
    private val binding get() = _binding!!
    private lateinit var api: ApiClient
    private val pickAudio = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        val file = copyUriToCache(uri) ?: return@registerForActivityResult
        runScan { api.scanAudio(file) }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentScanBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val prefs = AegisApp.get(requireContext()).prefs
        api = ApiClient(prefs.apiBaseUrl)
        val name = prefs.username
        binding.scanTitle.text = if (!name.isNullOrBlank()) "Welcome, $name" else "Scan Center"

        binding.profileBtn.text = if (!name.isNullOrBlank()) name.take(2).uppercase() else "ME"
        binding.profileBtn.setOnClickListener {
            findNavController().navigate(R.id.action_scan_to_profile)
        }

        AnimUtil.fadeInUp(binding.scanTitle)
        AnimUtil.fadeInUp(binding.profileBtn)
        binding.root.findViewById<View>(R.id.scanResultCard)?.let { AnimUtil.fadeInUp(it) }

        binding.scanTextBtn.setOnClickListener {
            AnimUtil.pulse(binding.scanTextBtn)
            val text = binding.scanInput.text?.toString()?.trim().orEmpty()
            if (text.isBlank()) {
                Toast.makeText(requireContext(), "Enter text to scan", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            runScan { api.scanText(text) }
        }

        binding.scanAudioBtn.setOnClickListener {
            pickAudio.launch("audio/*")
        }
    }

    private fun runScan(block: suspend () -> com.aegisai.app.data.ScanResult) {
        binding.scanProgress.isVisible = true
        binding.scanResultCard.isVisible = false
        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { block() }
                showResult(result)
            } catch (e: Exception) {
                showResult(com.aegisai.app.data.ScanResult(error = e.message))
            } finally {
                binding.scanProgress.isVisible = false
            }
        }
    }

    private fun showResult(result: com.aegisai.app.data.ScanResult) {
        binding.scanResultCard.isVisible = true
        AnimUtil.fadeInUp(binding.scanResultCard)
        if (result.error != null) {
            binding.scanResult.text = getString(R.string.error_prefix, result.error)
            return
        }
        val conf = result.confidence?.let { (it * 100).toInt() }
        val sb = StringBuilder()
        sb.append(getString(R.string.vishing_risk, result.risk))
        sb.append("\n")
        if (conf != null) {
            sb.append(getString(R.string.vishing_confidence, conf))
            sb.append("\n")
        }
        sb.append("Reason: ${result.reason}\n")
        result.transcription?.let {
            sb.append("\n")
            sb.append(getString(R.string.vishing_transcription_label))
            sb.append("\n")
            sb.append(it)
            sb.append("\n")
        }
        result.detected_keywords?.takeIf { it.isNotEmpty() }?.let {
            sb.append("\nKeywords: ${it.joinToString()}")
        }
        binding.scanResult.text = sb.toString()
        result.transcription?.let { binding.scanInput.setText(it) }
    }

    private fun copyUriToCache(uri: Uri): File? {
        return try {
            val out = File(requireContext().cacheDir, "upload_${System.currentTimeMillis()}.m4a")
            requireContext().contentResolver.openInputStream(uri)?.use { input ->
                out.outputStream().use { input.copyTo(it) }
            }
            out
        } catch (_: Exception) {
            null
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
