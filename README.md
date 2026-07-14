# Aegis AI 🛡️

Aegis AI is an intelligent, multi-platform security ecosystem designed to combat modern social engineering attacks, particularly Voice Phishing (Vishing) and SMS Phishing (Smishing). By leveraging state-of-the-art machine learning models and speech recognition, Aegis AI acts as a digital shield, proactively analyzing calls, messages, and web links to protect users from financial fraud and identity theft in real-time.

## 🚀 Features

*   **🎙️ Vishing (Voice Phishing) Detection:**
    *   Automatic call recording detection and analysis (Call Guard).
    *   Integration with system dialers to extract and analyze recordings post-call.
    *   Utilizes **Google Speech API** for rapid processing and **OpenAI Whisper** for robust multilingual transcription fallback (supporting Hindi, Marathi, Bengali, Tamil, Telugu, English, and Hinglish).
*   **📩 SMS Phishing (Smishing) Scanner:**
    *   Real-time parsing and analysis of incoming SMS messages.
    *   Detects deceptive language, urgent money requests, fake lottery wins, and impersonations of authorities (e.g., Police, Customs, Banks).
*   **🔗 Malicious Link Analysis:**
    *   Extracts and evaluates URLs found in messages or transcripts for phishing risks.
*   **🤖 Advanced AI Threat Scoring:**
    *   Employs custom NLP heuristics and Machine Learning models to generate a definitive "Risk Score" (Low, Medium, High) and Confidence Percentage for every interaction.
*   **🌐 Cross-Platform Access:**
    *   Includes a native Android app, a Flutter app, and a sleek web dashboard to view history and upload audio files manually.

## 🏗️ Project Structure

This repository is organized into the following primary components:

*   **`/android`**: The native Android application built with Kotlin. It handles background services, system notifications, media store querying for call recordings, and SMS intercepting.
*   **`/flutter_app`**: A cross-platform mobile application interface built with Dart and Flutter.
*   **`/backend`**: The Python FastAPI backend. This is the brain of Aegis AI, responsible for AI inference, NLP text analysis, audio preprocessing (FFmpeg), and multi-engine transcription routing.
*   **`/frontend`**: The React/Vite based web application dashboard for users to review analysis results, manage their profiles, and manually upload audio for vishing checks.
*   **`/ISDD_Dataset`**: Custom datasets and schemas for training/evaluating models specifically on Indian scam patterns.

## 🛠️ Technology Stack

*   **Mobile Clients:** Kotlin (Android Native), Flutter (Dart)
*   **Web Frontend:** React, Vite, TailwindCSS (or Vanilla CSS)
*   **Backend:** Python 3, FastAPI, Uvicorn, Gunicorn
*   **AI/ML:** OpenAI Whisper, SpeechRecognition (Google), custom NLP heuristics
*   **Audio Processing:** FFmpeg
*   **Infrastructure:** Render (Hosting), SQLite/PostgreSQL (Database)

## ⚙️ Getting Started

### Prerequisites
*   Node.js and npm (for frontend)
*   Python 3.10+ (for backend)
*   Android Studio (for Android app)
*   Flutter SDK (for Flutter app)
*   FFmpeg installed and accessible in the system PATH (required for audio enhancement on the backend).

### Backend Setup
1. Navigate to the `backend` directory: `cd backend`
2. Install dependencies: `pip install -r requirements.txt`
3. Start the server: `uvicorn main:app --reload`
*   *Note: Set `API_BASE_URL` in your app environments to point to your local or deployed backend.*

### Frontend Setup
1. Navigate to the `frontend` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Run the development server: `npm run dev`

### Android App Setup
1. Open the `/android` directory in Android Studio.
2. Allow Gradle to sync.
3. Build and run on an emulator or a physical device (Physical device recommended for testing Dialer/Call and SMS features).

## 🔒 Permissions & Privacy
Aegis AI requires certain permissions (like reading SMS, Call Screening roles, and accessing Media Storage) to function effectively on mobile devices. User privacy is a top priority: audio processing is heavily optimized, and unnecessary data is purged quickly after generating threat reports.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page or submit a Pull Request.

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.
