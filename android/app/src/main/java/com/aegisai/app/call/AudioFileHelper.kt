package com.aegisai.app.call

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import java.io.File

object AudioFileHelper {
    fun copyUriToCache(context: Context, uri: Uri): File? {
        return try {
            val ext = extensionForUri(context, uri)
            val out = File(context.cacheDir, "call_rec_${java.util.UUID.randomUUID()}.$ext")
            context.contentResolver.openInputStream(uri)?.use { input ->
                out.outputStream().use { output -> input.copyTo(output) }
            } ?: return null
            if (!out.exists() || out.length() == 0L) null else out
        } catch (_: Exception) {
            null
        }
    }

    private fun extensionForUri(context: Context, uri: Uri): String {
        val mime = context.contentResolver.getType(uri)
        if (!mime.isNullOrBlank()) {
            MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)?.takeIf { it.isNotBlank() }?.let {
                return it
            }
        }
        val name = uri.lastPathSegment.orEmpty().lowercase()
        return when {
            name.endsWith(".wav") -> "wav"
            name.endsWith(".mp3") -> "mp3"
            name.endsWith(".m4a") -> "m4a"
            name.endsWith(".aac") -> "aac"
            name.endsWith(".amr") -> "amr"
            name.endsWith(".ogg") -> "ogg"
            else -> "m4a"
        }
    }
}
