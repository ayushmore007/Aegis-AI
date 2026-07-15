<div align="center">

# 🛡️ Aegis AI

### AI-Powered Fraud & Phishing Detection Platform

Real-time scam detection across SMS, Email, and Voice — with English & Hinglish support.

[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Python](https://img.shields.io/badge/Backend-Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![NLP](https://img.shields.io/badge/ML-DistilBERT%20%2B%20Whisper-FF6B00)](https://huggingface.co/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel)](https://aegis-ai-three.vercel.app/)

[Live Demo](https://aegis-ai-three.vercel.app/) · [Report Bug](../../issues) · [Request Feature](../../issues)

</div>

---

## 📖 Overview

**Aegis AI** is a full-stack, intelligent threat detection platform designed to protect users from digital fraud in real time. It uses NLP-based classification to analyze incoming SMS messages, emails, and voice calls, and flags them as **safe**, **phishing**, **refund scams**, or **verification fraud** — before the user falls victim.

Built with a special focus on the Indian threat landscape, Aegis AI supports both **English and Hinglish** message analysis, covering common regional scam patterns like fake KYC updates, lottery frauds, OTP theft, and malicious APK downloads.

Beyond detection, Aegis AI takes a proactive approach to user safety through a **gamified anti-phishing training simulator** that teaches users to recognize real-world attack patterns through interactive scenarios with instant feedback.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔍 **Real-Time Scam Detection** | NLP engine classifies text into `safe`, `refund_scam`, `phishing`, or `verification_fraud` |
| 📩 **Auto Email Scanning** | Automated inbox scanning pipeline that analyzes incoming emails for threats |
| 📱 **SMS Auto-Scan** | Android companion architecture intercepts incoming SMS and scans them instantly |
| 🎙️ **Voice Call Analysis** | Whisper-powered audio transcription pipeline to detect vishing (voice phishing) |
| 🎮 **Gamified Training Simulator** | Interactive anti-phishing scenarios with immediate feedback to build user awareness |
| 📊 **Personal Security Dashboard** | Awareness score, risk profile, scan history, and smart alert toggles |
| 🌐 **Bilingual Support** | Detects scams written in both English and Hinglish |
| 🔔 **Native Alerts** | On-device local notifications warn users the moment a scam is detected |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AEGIS AI PLATFORM                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐        ┌──────────────────────────┐     │
│   │   Frontend   │  HTTP  │        Backend API       │     │
│   │ React + Vite │ ─────► │      Python (Flask/      │     │
│   │              │        │        FastAPI)          │     │
│   └──────────────┘        └───────────┬──────────────┘     │
│                                       │                     │
│   ┌──────────────┐        ┌───────────▼──────────────┐     │
│   │  Android App │  POST  │       ML Pipeline        │     │
│   │  (Kotlin SMS │ ─────► │  • NLP Classifier        │     │
│   │   Receiver)  │        │  • DistilBERT (fine-     │     │
│   └──────────────┘        │    tuned, EN/Hinglish)   │     │
│                           │  • Whisper (audio)       │     │
│   ┌──────────────┐        └───────────┬──────────────┘     │
│   │ Email Scanner│                    │                     │
│   │   (IMAP)     │        ┌───────────▼──────────────┐     │
│   └──────────────┘        │   Database (Supabase /   │     │
│                           │    SQL user profiles)    │     │
│                           └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Application Pages

- **`/landing`** — Premium entry point introducing the platform
- **`/login` & `/signup`** — User authentication
- **`/config`** — 3-step permissions setup (SMS, Audio, Email)
- **`/home`** — Core detection screen with the NLP scanning engine
- **`/history`** — Actionable list of all prior scans
- **`/simulate`** — Gamified anti-phishing training scenarios
- **`/dashboard`** — Personal analytics: awareness score, risk profile & smart alerts

---

## 🛠️ Tech Stack

**Frontend**
- React 18 + Vite
- React Router DOM
- Lucide React (icons)
- Custom CSS design system (`#FF6B00` accent, threat-status color coding)

**Backend**
- Python (Flask / FastAPI)
- NLP text classification engine
- OpenAI Whisper — audio transcription for call analysis
- DistilBERT — fine-tuned for English/Hinglish scam classification

**Infrastructure**
- Vercel (frontend deployment, hardened CSP security headers)
- Supabase / SQL (user profiles)

**Mobile (Integration Path)**
- Android (Kotlin) — `BroadcastReceiver` for real-time SMS interception

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.10
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/ayushmore007/Aegis-AI.git
cd Aegis-AI
```

### 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit **http://localhost:5173** in your browser.

### 3. Run the Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 4. Database Setup (optional)
Run `setup_profiles.sql` against your Supabase/SQL instance to create the user profiles table.

---

## 📚 Documentation

| Guide | Description |
|---|---|
| [`dataset_guide.md`](./dataset_guide.md) | How to collect & prepare EN/Hinglish data, train a baseline model, or fine-tune DistilBERT |
| [`auto_email_setup_guide.md`](./auto_email_setup_guide.md) | Setting up automated email inbox scanning |
| [`auto_sms_documentation.md`](./auto_sms_documentation.md) | Building the Android SMS auto-scan companion service |
| [`implementation_plan.md`](./implementation_plan.md) | Security hardening & deployment notes |
| [`walkthrough.md`](./walkthrough.md) | Full project walkthrough of what has been implemented |

---

## 🎯 Threat Categories Detected

- **Phishing** — fake login pages, credential harvesting attempts, spoofed sender addresses
- **Refund Scams** — fraudulent refund/cashback offers requesting payment details
- **Verification Fraud** — fake KYC, OTP, and account-verification requests
- **Malicious Downloads** — links pushing `.apk` / `.exe` payloads

---

## 🗺️ Roadmap

- [ ] Full production backend integration with the trained DistilBERT model
- [ ] Publish the Android companion app for native SMS auto-scanning
- [ ] Real-time voice call scam detection via streaming Whisper transcription
- [ ] Browser extension for URL scanning
- [ ] Multi-language expansion beyond English/Hinglish

---

## ⚠️ Disclaimer

Aegis AI is a **cybersecurity education and protection tool**. The scam examples included in the training simulator are for educational purposes only, to help users recognize and avoid real-world fraud. This project does not engage in, promote, or facilitate any malicious activity.

---

## 🤝 Contributing

Contributions are welcome! Feel free to open an [issue](../../issues) or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 👤 Author

**Ayush More**
GitHub: [@ayushmore007](https://github.com/ayushmore007)

---

<div align="center">

*Built to make the internet a safer place — one scan at a time.* 🛡️

</div>
