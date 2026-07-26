package com.aegisai.app.ui.call

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.aegisai.app.call.AudioFileHelper
import com.aegisai.app.call.CallAnalysisNotifier
import com.aegisai.app.call.CallGuardCoordinator

/** Transparent activity launched from notification to pick a dialer recording manually. */
class CallRecordingPickerActivity : AppCompatActivity() {
    private val pickAudio = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        val sessionId = intent.getStringExtra(CallAnalysisNotifier.EXTRA_SESSION_ID)
        if (uri == null || sessionId.isNullOrBlank()) {
            finish()
            return@registerForActivityResult
        }
        val cacheFile = AudioFileHelper.copyUriToCache(this, uri)
        if (cacheFile == null) {
            Toast.makeText(this, "Could not read the selected file", Toast.LENGTH_SHORT).show()
            finish()
            return@registerForActivityResult
        }
        val fileUri = Uri.fromFile(cacheFile)
        CallGuardCoordinator.analyzeManualRecording(this, sessionId, fileUri)
        Toast.makeText(this, com.aegisai.app.R.string.call_guard_manual_upload_started, Toast.LENGTH_SHORT).show()
        startActivity(CallAnalysisResultActivity.intent(this, sessionId))
        finish()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pickAudio.launch("audio/*")
    }

    companion object {
        fun intent(context: Context, sessionId: String): Intent =
            Intent(context, CallRecordingPickerActivity::class.java).apply {
                putExtra(CallAnalysisNotifier.EXTRA_SESSION_ID, sessionId)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
    }
}
