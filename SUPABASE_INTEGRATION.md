# Supabase Integration Analysis for UniPass

## Current Architecture (PURE OFFLINE-FIRST)

```
Device (Private Key) ←→ Backend (JWT Validation) 
              ↓
         Offline TOTP
     (No cloud dependency)
```

**Pros:**
- ✅ Works completely offline (core feature)
- ✅ Private keys never leave device
- ✅ High security (zero cloud exposure)
- ✅ Zero-downtime guaranteed

**Cons:**
- ❌ Manual user management
- ❌ No centralized audit trail
- ❌ No real-time analytics
- ❌ Device trust requires manual verification

---

## Supabase Integration (HYBRID APPROACH)

```
┌─────────────────────────────────────────────┐
│           Supabase Cloud                    │
│  ┌──────────────────────────────────────┐  │
│  │ Auth (Email OTP, OAuth)              │  │
│  │ Database (users, devices, audit)     │  │
│  │ Realtime subscriptions               │  │
│  │ Edge Functions (custom logic)        │  │
│  └──────────────────────────────────────┘  │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
Device Auth          Backend API
(Email OTP from      (JWT validation,
 Supabase)           TOTP verification)
    │                     │
    └─────────────────────┘
         Offline Cache
    (Private Keys Local)
```

---

## Does Supabase Defeat Zero-Downtime?

### ❌ If Used For Token Validation
```javascript
// BAD: Defeats offline purpose
Device → Supabase Auth → Token Return ✗
         (If Supabase down, everything fails)
```

### ✅ If Used For Management Only
```javascript
// GOOD: Preserves offline capability
1. Device has TOTP secret (stored locally)
2. Generate offline token without external dependency
3. When online: Send token to Backend (not Supabase)
4. Backend validates TOTP locally, logs to Supabase
```

**VERDICT: ✅ Supabase DOES NOT defeat zero-downtime if architected correctly**

---

## What Supabase Adds

### 1. **User Management**
- Instead of: Manual user registration
- With Supabase: Email/password, OAuth (Google, GitHub, Microsoft)
- Benefit: Easy student onboarding, MFA options

```javascript
// Supabase Auth
const { user } = await supabase.auth.signInWithPassword({
  email: studentId + '@campus.edu',
  password: tempPassword, // Initial setup
});
```

### 2. **Device Registration**
- Store which devices have which TOTP secrets
- Track device trust (biometric unlock, PIN)
- Revoke access from compromised devices

```javascript
// Supabase Database Table: device_keys
Schema:
  id (UUID)
  user_id (FK to auth.users)
  device_name (string)
  public_key (string) // Device certificate
  totp_secret (encrypted string) // Stored encrypted
  is_trusted (boolean)
  created_at, updated_at
```

### 3. **Audit Trail**
- Centralized logging of all authentication events
- Compliance (FERPA, campus regulations)
- Real-time analytics dashboard

```javascript
// Supabase Database Table: audit_log
Schema:
  id (UUID)
  student_id (FK)
  resource_id (string)
  auth_type ('ONLINE' | 'OFFLINE')
  status ('SUCCESS' | 'FAILED')
  timestamp (timestamp)
  ip_address (string)
  device_id (FK to device_keys)
```

### 4. **Real-Time Analytics**
- Live user count, authentication patterns
- Alert on suspicious activity (too many offline auths)
- Generate PDF reports

```javascript
// Supabase Realtime Subscription
supabase
  .from('audit_log')
  .on('INSERT', payload => {
    console.log('New auth event:', payload.new);
    updateDashboard(payload.new);
  })
  .subscribe();
```

---

## Detailed Architecture: Supabase + UniPass

### Phase 1: Initial Authentication (First-Time Setup)

```
Student → Dashboard (Web)
   ↓
1. Supabase Auth:
   - Input: Email + password
   - Supabase generates Auth session

2. Backend Registration:
   - Receive email from Supabase JWT
   - Generate TOTP secret (32-char Base32)
   - Return secret to mobile (encrypted channel)

3. Mobile Storage:
   - React Native Keychain stores secret
   - Also stores in AsyncStorage (encrypted backup)
   - Never syncs to Supabase

4. Supabase Database:
   - Record: device_keys table with public_key only
   - NOT stored: TOTP secret (too sensitive)
   - Purpose: Device trust registration
```

### Phase 2: Daily Use (Online)

```
Student scans lab door QR reader
   ↓
1. Mobile App:
   - Health check to Backend (/health)
   - Backend reachable → ONLINE mode
   - Fetch JWT from /get-token endpoint

2. Backend:
   - Validates student token from Supabase session
   - Signs JWT with server private key
   - Returns JWT

3. Mobile:
   - Embeds JWT in QR code
   - QR scanned by reader → sent to Backend
   - Backend validates JWT signature
   - Grants access

4. Audit Trail:
   - Backend logs to Supabase audit_log
   - Includes: student_id, resource, ONLINE, timestamp
   - Dashboard updates in real-time
```

### Phase 3: Offline Operation (Network Down)

```
Campus network is down (internet outage)
   ↓
1. Mobile App:
   - Health check fails (timeout 500ms)
   - OFFLINE mode activated

2. Mobile:
   - Retrieves TOTP secret from Keychain
   - Generates TOTP code (changes every 30s)
   - Creates offline token with signature
   - Embeds in QR code

3. Physical Reader:
   - Scans QR code
   - Stores token locally (can't reach backend)
   - Queues verification request

4. When Network Returns:
   - Backend receives queued token
   - Validates TOTP (check if within window)
   - Validates timestamp (TTL 5 minutes)
   - Validates signature
   - Logs to Supabase audit_log as OFFLINE auth

5. Dashboard:
   - Shows "OFFLINE" badge for those events
   - Campus admin can see which auths were offline
```

---

## Security Analysis: Private Keys Never Touch Supabase

### ✅ Keys Stored on Device Only
```
Device Keychain:
  - TOTP secret (32 bytes, Base32)
  - Private signing key (for offline tokens)
  - Encrypted by OS (Android TEE, iOS Secure Enclave)
  - Require biometric/PIN to access
```

### ✅ What Supabase Stores
```
Supabase Database (SAFE to expose):
  - User profile (name, email, student ID)
  - Device registration (name, public_key, trust status)
  - Audit log (what happened, when, where)
  
❌ NEVER stored in Supabase:
  - TOTP secrets
  - Private keys
  - Session tokens with full permissions
```

### ✅ Compromise Scenarios

**If Backend is compromised:**
- Attacker cannot generate offline tokens (secret on device)
- Attacker cannot read audit trail (past events, limited)
- Recovery: Revoke device from Supabase, re-register

**If Supabase is compromised:**
- Attacker cannot generate tokens (secrets not there)
- Attacker cannot read device keystore (encrypted locally)
- Attacker can see audit trail (already happened, timestamp-locked)
- Recovery: Rotate secrets, re-issue to devices

**If Device is stolen:**
- Attacker cannot access Keychain (requires biometric OR 24hr lockout)
- Admin can revoke device from Supabase dashboard
- New device required for future auth

---

## Recommended Supabase Schema

```sql
-- Users (managed by Supabase Auth)
create table user_profiles (
  id uuid primary key references auth.users,
  student_id varchar(20) unique not null,
  full_name varchar(255),
  email varchar(255),
  created_at timestamp default now()
);

-- Device Registration
create table device_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  device_name varchar(100),
  public_key text not null,  -- Device certificate for signature verification
  is_trusted boolean default false,
  last_used_at timestamp,
  created_at timestamp default now(),
  unique(user_id, device_name)
);

-- Audit Trail (append-only)
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  student_id varchar(20) not null,
  device_id uuid references device_keys,
  resource_id varchar(50) not null,  -- Lab-01, Library, etc.
  auth_type varchar(20) not null,     -- 'ONLINE' or 'OFFLINE'
  status varchar(20) not null,        -- 'SUCCESS' or 'FAILED'
  timestamp timestamp not null,
  ip_address inet,
  user_agent varchar(500),
  created_at timestamp default now()
);

-- Create indexes for fast queries
create index idx_audit_log_student on audit_log(student_id);
create index idx_audit_log_timestamp on audit_log(timestamp desc);
create index idx_device_keys_user on device_keys(user_id);
```

---

## Supabase Setup Steps

### 1. Create Project
```bash
# https://supabase.io/dashboard
# New Project > Name: UniPass > Billing (Free tier OK for demo)
# Wait for PostgreSQL setup (2 min)
```

### 2. Enable Auth
- Go to Authentication > Providers
- Enable: Email
- Enable: Allow insecure connections (for local testing)
- Copy API Keys (anon, service_role)

### 3. Create Tables
```bash
# Copy schema above into SQL Editor
# Run to create tables and indexes
```

### 4. Configure Backend
```javascript
// backend/server.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Endpoint: POST /auth/register
app.post('/auth/register', async (req, res) => {
  // 1. Create Supabase auth user
  const { user } = await supabase.auth.admin.createUser({
    email: req.body.email,
    password: req.body.password,
    email_confirm: false,
  });
  
  // 2. Store profile
  await supabase
    .from('user_profiles')
    .insert({ id: user.id, student_id: req.body.studentId });
  
  // 3. Generate + return TOTP secret
  const secret = generateBase32Secret();
  res.json({ secret, userId: user.id });
});

// Endpoint: POST /verify-handshake
app.post('/verify-handshake', async (req, res) => {
  const { token, type } = req.body;
  
  if (type === 'ONLINE_JWT') {
    // Validate JWT signature
    const payload = verifyJWT(token);
    await supabase
      .from('audit_log')
      .insert({
        student_id: payload.studentId,
        resource_id: payload.resourceId,
        auth_type: 'ONLINE',
        status: 'SUCCESS',
      });
    res.json({ success: true });
  } else if (type === 'OFFLINE_TOTP') {
    // Validate TOTP + signature
    const isValid = await verifyOfflineToken(token);
    await supabase
      .from('audit_log')
      .insert({
        student_id: token.studentId,
        resource_id: token.resourceId,
        auth_type: 'OFFLINE',
        status: isValid ? 'SUCCESS' : 'FAILED',
      });
    res.json({ success: isValid });
  }
});
```

### 5. Configure Mobile
```javascript
// mobile/src/utils/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://your-project.supabase.co',
  'anon-key-here'
);

// Sign up: mobile/src/screens/RegisterScreen.jsx
const signUp = async (email, password) => {
  const { user, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  
  // Get TOTP secret from backend
  const response = await fetch('http://10.0.2.2:5000/register', {
    method: 'POST',
    body: JSON.stringify({ userId: user.id, email }),
  });
  
  const { secret } = await response.json();
  
  // Store in Keychain
  await SecureKeyStore.storePrivateKey(email, secret);
};
```

---

## Cost Analysis

| Service | Plan | Cost | Why |
|---------|------|------|-----|
| Supabase | Free tier | $0 | 500MB DB, 2GB storage, bandwidth |
| Backend | AWS EC2 t3.micro | $1-5/month | JWT validation, TOTP check |
| Dashboard | Netlify Free | $0 | Static React app |
| Mobile | Testing only | $0 | Android Emulator (free) |

**Total Monthly: ~$1-5** (production would be $20-50/month for reliable infrastructure)

---

## Migration Path: From Current to Supabase

### Today (No Supabase)
```
Device → Backend (JWT) → Hardcoded audit file
```

### Day 1 (Add Supabase Auth)
```
Device → Supabase Auth → Backend JWT → Supabase audit log
```

### Day 2 (Add Device Management)
```
Device registers with Backend → Stored in Supabase device_keys
Maintains backward compatibility (no breaking changes)
```

### Day 3 (Full Integration)
```
Supabase Auth, Device Management, Real-time Analytics
Complete enterprise security posture
Zero breaking changes to mobile/backend
```

---

## Final Verdict

**Does Supabase defeat the zero-downtime purpose?**

### 🚨 NO - If Implemented Correctly

✅ **Keep on Device:**
- TOTP secrets
- Private signing keys
- Session tokens

✅ **Move to Supabase:**
- User authentication
- Device registration
- Audit trails
- Analytics

✅ **Architecture Preserves:**
- Offline functionality (secrets are local)
- Zero-downtime (TOTP generation doesn't need cloud)
- Security (keys never leave device)

### 💡 Pro Tip
Think of Supabase as "audit trail + management" layer, not "token validation" layer. Backend validates tokens locally, Supabase records what happened.

---

## Resources

- Supabase Docs: https://supabase.io/docs
- TOTP RFC 6238: https://tools.ietf.org/html/rfc6238
- React Native Keychain: https://github.com/oblador/react-native-keychain
- Zero-Trust Security: https://www.nist.gov/publications/zero-trust-architecture
