# UniPass Mobile - Setup Instructions

## Problem: Missing Android/iOS Native Folders

The React Native project requires native Android and iOS folders that must be generated using the React Native CLI.

## Solution: Two Options

---

## ✅ **Option 1: Use React Native CLI (Recommended for Production)**

This creates a full React Native project with native code.

### Prerequisites
- Node.js 18+ installed
- For Android: Android Studio + SDK
- For iOS: macOS with Xcode

### Steps

1. **Backup our custom files**:
```bash
cd mobile
mkdir ../mobile-backup
cp -r components utils App.jsx ../mobile-backup/
cd ..
```

2. **Remove the mobile folder**:
```bash
rm -rf mobile
```

3. **Initialize a new React Native project**:
```bash
npx react-native@latest init UniPassMobile
```

4. **Restore our custom files**:
```bash
cd UniPassMobile
cp -r ../mobile-backup/* .
```

5. **Install dependencies**:
```bash
npm install @react-native-async-storage/async-storage
npm install react-native-keychain
npm install react-native-qrcode-svg
npm install react-native-svg
npm install otplib
npm install crypto-js
```

6. **Link native modules (iOS)**:
```bash
cd ios
pod install
cd ..
```

7. **Run the app**:
```bash
# Android
npx react-native run-android

# iOS (macOS only)
npx react-native run-ios
```

---

## ✅ **Option 2: Use Expo (Easiest Setup)**

Expo handles native modules automatically and is perfect for getting started quickly.

### Steps

1. **Backup our custom files**:
```bash
cd mobile
mkdir ../mobile-backup
cp -r components utils App.jsx ../mobile-backup/
cd ..
```

2. **Remove the mobile folder**:
```bash
rm -rf mobile
```

3. **Create Expo project**:
```bash
npx create-expo-app@latest UniPassMobile --template blank
cd UniPassMobile
```

4. **Install dependencies**:
```bash
npx expo install @react-native-async-storage/async-storage
npx expo install expo-secure-store
npx expo install react-native-svg
npm install react-native-qrcode-svg
npm install otplib
npm install crypto-js
```

5. **Restore our custom files**:
```bash
cp -r ../mobile-backup/components .
cp -r ../mobile-backup/utils .
```

6. **Update App.js**:
```javascript
// Copy content from ../mobile-backup/App.jsx
```

7. **Modify SecureKeyStore.js for Expo**:
Replace `react-native-keychain` with `expo-secure-store`:

```javascript
import * as SecureStore from 'expo-secure-store';

export const storePrivateKey = async (privateKey) => {
  try {
    await SecureStore.setItemAsync('unipass_private_key', privateKey);
    return true;
  } catch (error) {
    console.error('Failed to store private key:', error);
    return false;
  }
};

export const retrievePrivateKey = async () => {
  try {
    return await SecureStore.getItemAsync('unipass_private_key');
  } catch (error) {
    console.error('Failed to retrieve private key:', error);
    return null;
  }
};
```

8. **Run the app**:
```bash
npx expo start

# Then:
# - Press 'a' for Android
# - Press 'i' for iOS
# - Scan QR code with Expo Go app
```

---

## 🔧 **Option 3: Quick Fix (Current Setup)**

If you want to keep the current structure and just test the components, create minimal native folders:

### For Android

1. **Create Android folder structure**:
```bash
cd mobile
mkdir -p android/app/src/main/java/com/unipass
mkdir -p android/app/src/main/res
```

2. **Create basic AndroidManifest.xml**:
```bash
cat > android/app/src/main/AndroidManifest.xml << 'EOF'
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.unipass">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.USE_BIOMETRIC" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:allowBackup="false"
        android:theme="@style/AppTheme">
        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF
```

3. **Create build.gradle**:
```bash
cat > android/build.gradle << 'EOF'
buildscript {
    ext {
        buildToolsVersion = "34.0.0"
        minSdkVersion = 23
        compileSdkVersion = 34
        targetSdkVersion = 34
        ndkVersion = "25.1.8937393"
        kotlinVersion = "1.9.22"
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.1.1")
        classpath("com.facebook.react:react-native-gradle-plugin")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin")
    }
}
EOF
```

**But this is complex and error-prone. I recommend Option 1 or 2 instead.**

---

## 📱 **Recommended Path: Use Expo (Option 2)**

For your use case, **Expo is the best choice** because:

✅ No need for Android Studio or Xcode setup
✅ Automatic native module handling
✅ Instant testing with Expo Go app
✅ Hot reload and fast development
✅ Easy deployment to app stores
✅ All our components will work with minimal changes

### Quick Expo Setup (5 minutes):

```bash
# 1. Backup files
cd mobile
mkdir ../temp-backup
cp -r components utils App.jsx ../temp-backup/
cd ..

# 2. Remove current folder
rm -rf mobile

# 3. Create Expo app
npx create-expo-app@latest mobile --template blank
cd mobile

# 4. Install deps
npx expo install @react-native-async-storage/async-storage expo-secure-store react-native-svg
npm install react-native-qrcode-svg otplib crypto-js

# 5. Copy files back
cp -r ../temp-backup/* .

# 6. Start
npx expo start
```

Then just scan the QR code with Expo Go app (free on Play Store/App Store).

---

## 🔒 **Security Note for Expo**

Update `mobile/utils/SecureKeyStore.js` to use Expo Secure Store:

```javascript
import * as SecureStore from 'expo-secure-store';
// Remove: import * as Keychain from 'react-native-keychain';

// Update storePrivateKey
export const storePrivateKey = async (privateKey) => {
  try {
    await SecureStore.setItemAsync('unipass_private_key', privateKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return true;
  } catch (error) {
    console.error('Failed to store private key:', error);
    return false;
  }
};

// Update retrievePrivateKey
export const retrievePrivateKey = async () => {
  try {
    return await SecureStore.getItemAsync('unipass_private_key');
  } catch (error) {
    console.error('Failed to retrieve private key:', error);
    return null;
  }
};

// Update clearSecureStorage
export const clearSecureStorage = async () => {
  try {
    await SecureStore.deleteItemAsync('unipass_private_key');
    await AsyncStorage.multiRemove(['unipass_user_id', 'unipass_device_id']);
    return true;
  } catch (error) {
    console.error('Failed to clear secure storage:', error);
    return false;
  }
};
```

---

## 📞 Need Help?

If you encounter issues, check:
- Node version: `node --version` (should be 18+)
- NPM version: `npm --version` (should be 9+)
- Clear cache: `npx expo start -c` or `npm start --reset-cache`

**Bottom line: Use Expo for fastest setup! 🚀**
