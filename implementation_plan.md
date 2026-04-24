# Aegis AI Implementation Plan

## Goal Description
Build Aegis AI, an AI-powered multilingual cybersecurity assistant. The app will feature a modern, dynamic UI matching the provided Xiaomi smart home dashboard design (dark sidebar + light rounded cards). It includes text/audio/email scanning, a gamified phishing simulator, and personal awareness tracking.

## Proposed Changes

### Setup & Boilerplate
- Initialize a **React + Vite** frontend.
- Use **Vanilla CSS** for premium styling, animations, and matching the requested aesthetic.
- Setup routing with `react-router-dom` for the requested pages: `/landing`, `/login`, `/signup`, `/config`, `/home`, `/history`, `/simulate`, `/dashboard`.

### Components & Design System
- **Sidebar**: Dark mode glassmorphic vertical nav with icons, active states.
- **Card Layout**: Soft shadow, rounded corners, light gray background (`#f5f5f5` or similar), modern sans-serif typography (Inter/Outfit).
- **Icons**: React-icons (Lucide or Heroicons).
- **Core Components**:
  - `Layout`: Contains Sidebar and main content area.
  - `ScanInput`: Text area and file uploader for suspicious content.
  - `RiskBadge`: Visual indicator for SAFE (Green), SUSPICIOUS (Yellow), SCAM (Red/High).
  - `StatCard`: For Dashboard awareness scores.

### Pages
- **`/landing`**: Hero section with 3-step value prop.
- **`/login` & `/signup`**: Mock authentication forms with clean design.
- **`/config`**: Permission modal UI (SMS, Call, Email) + fallback inputs.
- **`/home`**: Main detection interface simulating NLP Engine (outputs Risk, Confidence, Reason). Emulating FraudLens label patterns (refund_scam, impersonation, etc.).
- **`/history`**: List of previous scans with interactive cards.
- **`/simulate`**: Gamified training interface with mock scenarios.
- **`/dashboard`**: Personal analytics matching the provided screenshot's aesthetic (Profile, Scores, Vulnerability text).

## Verification Plan

### Automated Tests
- Since this is a UI-heavy React application, I will use browser subagents to verify the routes actually render correctly.
- Test `npm run build` to ensure no compile errors.

### Manual Verification
- Ask the user to run `npm run dev` and open `localhost:5173`.
- Verify the routing works.
- Verify the main dashboard looks like the provided screenshot.
- Verify the mock detection engine spits out appropriate reasons.
