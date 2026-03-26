# 🚀 UniPass - Complete Setup Guide (Android Studio + Node.js + React)

> **Zero-Downtime Campus Authentication System** with FIDO2, TOTP Offline Fallback, and Real-Time Monitoring

---

## 📋 Project Structure

```
UniPass/
├── mobile/               # React Native Android App
│   ├── android/          # Native Android project (Java/Gradle)
│   ├── src/
│   │   ├── components/   # SmartQRGenerator.jsx
│   │   ├── screens/      # App screens
│   │   └── utils/        # ConnectivityDetection, SecureKeyStore, TOTPGenerator
│   ├── App.jsx           # Root React Native component
│   ├── index.js          # Entry point
│   └── package.json      # Dependencies
├── dashboard/            # React.js Web Dashboard
│   ├── src/
│   │   ├── components/   # SecurityHealth.jsx
│   │   └── main.jsx      # Root component
│   └── package.json      # Vite + Tailwind
├── backend/              # Node.js/Express API
│   ├── server.js         # Main server
│   └── utils/            # JWT, TOTP verification
└── shared/               # Common utilities
```

---

## 🛠️ Prerequisites

Before starting, install:

1. **Android Studio** (https://developer.android.com/studio)
   - JDK 17+ (comes with Android Studio)
   - Android SDK (API 34, minimum API 21)

2. **Node.js** (v18.x+) - https://nodejs.org/
   - Includes npm

3. **VS Code** (optional but recommended)
   - Extensions: "Android" by Microsoft, "React Native Tools"

---

## 📱 Step 1: Android Studio Setup & Emulator

### 1.1 Install Android Studio
1. Download from https://developer.android.com/studio
2. Run installer and follow prompts
3. Install Android SDK:
   - Open Android Studio
   - **Tools** → **SDK Manager**
   - Ensure installed:
     - Android API 34 (API Level 34)
     - Android API 21 (minimum support)
     - Android SDK Build-Tools 34.0.0
     - Android Emulator

### 1.2 Create Android Virtual Device (Emulator)
1. **Tools** → **Device Manager** → **Create Virtual Device**
2. Select Pixel 6 (or your preference)
3. Select API 34 system image
4. Name: `Emulator-API34`
5. Click **Finish**

### 1.3 Launch Emulator
```powershell
# Option A: Using Android Studio (Device Manager button)
# Option B: Using terminal
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd Emulator-API36

# Verify emulator is running
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
```
Expected output:
```
emulator-5554   device
```

---

## 💻 Step 2: Backend Setup (Node.js/Express)

```bash
cd backend
npm install
npm run dev
```

**Expected Output:**
```
✓ Server running on http://localhost:5000
✓ /health endpoint ready for connectivity checks
✓ JWT signing active
```

Backend endpoints:
- `GET /health` - Health check (0.5s timeout)
- `POST /verify-handshake` - JWT & TOTP validation

---

## 🎨 Step 3: Dashboard Setup (React/Tailwind)

```bash
cd dashboard
npm install
npm run dev
```

Opens at `http://localhost:5173`

**SecurityHealth Component Features:**
- Status badge: "☁️ CLOUD-SYNC ACTIVE" vs "⬇️ LOCAL VALIDATION MODE"
- Real-time audit trail (Student ID, Resource, Auth Type, Timestamp)
- Metrics: Total Auth, Online/Offline split, Active Users, Latency, Uptime

---

## 📱 Step 4: Mobile App (React Native + Android)

### 4.1 Install Dependencies
```bash
cd mobile
npm install
```

### 4.2 Configure Android in VS Code
1. Open `mobile/` folder in VS Code
2. Install extensions:
   - **Android** (Microsoft)
   - **React Native Tools** (Microsoft)

### 4.3 Connect Backend URL to Emulator
Edit `mobile/src/utils/ConnectivityDetection.js`:
```javascript
const HEALTH_CHECK_URL = 'http://10.0.2.2:5000/health'; // Emulator's localhost mapping
```

### 4.4 Build & Run on Emulator

```powershell
# Terminal 1: Start Metro bundler (JavaScript packager)
cd mobile
npm start

# Terminal 2: Build and run on Android
npm run android

# Or manually:
cd mobile/android
./gradlew installDebug
adb shell am start -n com.unipass/.MainActivity
```

**If asked to install gradle plugin, press `y`**

### Success Indicators:
- Emulator shows UniPass app loading
- SmartQRGenerator screen appears with neon styling
- Status badge shows "CHECKING" then "ONLINE" or "OFFLINE"

---

## 🔐 How It Works: Zero-Downtime Architecture

### Online Mode (Cloud-Sync Active)
```
Mobile App → Health Check (500ms) → Server ✓
    ↓
Generate QR with JWT token
    ↓
Backend validates JWT signature
    ↓
Grant access, log event
```

### Offline Mode (Local Validation)
```
Mobile App → Health Check → Server ✗ TIMEOUT
    ↓
Retrieve private key from Secure Keystore
    ↓
Generate TOTP-signed offline token with timestamp
    ↓
QR contains: { studentId, totp, signature, timestamp }
    ↓
When online again: Backend validates TOTP + signature + TTL
    ↓
Grant retroactive access, log event
```

### Key Components:

**ConnectivityDetection.js**
- Monitors `navigator.onLine`
- Pings `/health` endpoint (500ms timeout)
- Emits events: "ONLINE" | "OFFLINE"

**SecureKeyStore.js**
- Primary: React Native Keychain (encrypted hardware storage)
- Fallback: AsyncStorage (encrypted with AES-256)
- Stores TOTP secrets retrieved from server

**TOTPGenerator.js**
- Generates RFC 6238 TOTP codes (6-digit, 30s window)
- Creates offline tokens with TTL (5 minutes)
- Validates timestamps to prevent replay attacks

**SmartQRGenerator Component**
- Monitors connectivity in real-time
- Auto-generates new QR every 5 seconds
- Shows current mode: ONLINE | OFFLINE
- Displays last authentication event

---

## 📊 Debugging

### Check Emulator Connection
```powershell
# List connected devices
adb devices

# View logs in real-time
adb logcat *:S ReactNative:V

# Install debug APK manually
adb install mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### Check Backend Health
```powershell
# From host Windows machine
curl http://localhost:5000/health

# From emulator (use 10.0.2.2 instead of localhost)
adb shell "curl http://10.0.2.2:5000/health"
```

### Common Issues

| Problem | Solution |
|---------|----------|
| "Android project not found" | Already fixed - using proper React Native CLI setup |
| Emulator won't start | Check BIOS virtualization enabled, 8GB+ RAM available |
| "Cannot find SDK" | Set `ANDROID_HOME` environment variable to SDK location |
| App crashes on launch | Check metro bundler is running (`npm start` in mobile/) |
| Cannot reach backend | Verify emulator uses `http://10.0.2.2:5000` not `localhost` |
| Keychain unavailable | Fallback to AsyncStorage automatically works |

---

## 🔑 Security Features Explained

### No Passwords Ever
- Uses FIDO2 (WebAuthn) for browser auth
- TOTP-signed tokens for mobile (RFC 6238)
- Private keys never leave device

### Offline Tokens Are Verifiable
- TOTP codes are mathematically bound to secret
- Timestamp prevents replay attacks (5-min TTL)
- Signature validates data integrity
- Server validates TOTP using same secret

### Zero-Downtime Guarantee
- 500ms health check ensures fast fallback
- Offline tokens stored with full metadata
- Audit trail tracks both online and offline events
- Graceful degradation - app always functional

---

## 📡 Connecting Dashboard to Backend

The SecurityHealth component auto-connects via:
```javascript
// Backend WebSocket or polling
const mockAuditTrail = [
  { studentId: 'STU2024001', resource: 'Lab-01', authType: 'ONLINE', timestamp: '5s ago' }
  // ... more events
];
```

Replace mock data with real API call:
```javascript
useEffect(() => {
  fetch('http://localhost:5000/audit-trail')
    .then(r => r.json())
    .then(setAuditTrail);
}, []);
```

---

## ❓ Supabase Integration - Does It Defeat the Purpose?

### Our Zero-Downtime Purpose
- **Goal**: Works when server is unreachable (campus network down, internet outage)
- **Solution**: TOTP secrets stored on device → offline tokens verifiable without server

### If You Add Supabase
```
 ✗ Single point of failure at Supabase cloud
 ✓ But: Can cache Supabase data locally using Supabase JS client + realtime subscriptions
 ✗ Offline tokens still need TOTP secret (must be pre-synced)
 ✓ Plus: Easier user management, audit logging, analytics
```

### Recommendation: **Hybrid Approach**
1. Keep TOTP secrets and private keys on **device** (no cloud)
2. Use **Supabase for**:
   - User authentication (email OTP)
   - Device registration (QR trust)
   - Audit trail storage
   - Analytics dashboard
3. Backend validates tokens **locally** (doesn't need Supabase)

```
Device → Backend (JWT) → Supabase (audit log) ✓
Device (offline) → Generate TOTP → Queue audit log → Sync when online ✓
```

**Conclusion**: Supabase enhances security (better auth) without breaking offline capability.

---

## 🎯 Next Steps

1. **Start Backend**: `cd backend && npm run dev`
2. **Start Dashboard**: `cd dashboard && npm run dev`
3. **Launch Emulator**: Android Studio Device Manager
4. **Start Mobile App**: `cd mobile && npm start`, then `npm run android`
5. **Test Zero-Downtime**:
   - Generate QR in app (ONLINE mode)
   - Disconnect WiFi/internet on development machine
   - Generate new QR (should fall back to OFFLINE mode automatically)
   - Check dashboard shows both online and offline events

---

## 📚 File Reference

| File | Purpose |
|------|---------|
| `mobile/src/utils/ConnectivityDetection.js` | Network status monitoring, 500ms health check |
| `mobile/src/utils/SecureKeyStore.js` | Keychain/AsyncStorage for TOTP secrets |
| `mobile/src/utils/TOTPGenerator.js` | RFC 6238 TOTP generation & offline token creation |
| `mobile/src/utils/verifyHandshake.js` | Smart handshake orchestration |
| `mobile/src/components/SmartQRGenerator.jsx` | QR display, connectivity UI |
| `dashboard/src/components/SecurityHealth.jsx` | Audit trail, metrics, status badge |
| `backend/server.js` | JWT validation, TOTP verification |

---

**Built with ❤️ for zero-downtime campus authentication**
