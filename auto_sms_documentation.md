# Auto-Scan SMS Integration Guide 

Aegis AI relies on a Web Application architecture which blocks native phone access. 
To implement the "Auto-scan SMS" feature as a real functioning product, you must deploy an **Android Background Service**.

## Step 1: Create an Android App (Kotlin)
Your Android App needs the following permissions in its `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.RECEIVE_SMS" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Step 2: Build the SMS Broadcast Receiver
Whenever a text arrives on the phone, the OS wakes up this `BroadcastReceiver`. It extracts the text and immediately POSTs it to our FastAPI server in the background.

```kotlin
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            for (sms in messages) {
                val messageBody = sms.messageBody
                val sender = sms.originatingAddress
                
                // POST Request to our Aegis AI Server
                sendToAegisBackend(sender, messageBody)
            }
        }
    }

    private fun sendToAegisBackend(sender: String?, message: String) {
        // Construct JSON
        val requestBody = """
            { "text": "$message" }
        """.trimIndent()
        
        // Execute HTTP POST to http://your-backend.com/api/scan
        // If the backend returns "SCAM", trigger a Local Notification natively warning the user!
    }
}
```

## Step 3: Call Recording Integration
Call recording is highly restricted on Android 10+. You would need to use `MediaRecorder.AudioSource.VOICE_COMMUNICATION` and request Accessibility Service permissions to legally capture VoIP/Phone audio chunks, and stream them continuously to our Whisper `/api/scan-audio` endpoint.
