# Bug Fixes Applied - 2026-06-02

## Issues Found & Fixed

### 1. ✅ Missing Dependencies
**Problem:** App tidak bisa dibuka karena missing peer dependencies
**Symptoms:** 
- Metro bundler tidak start
- `expo-doctor` menunjukkan 4 error

**Fixed:**
```bash
npm install expo-constants@~56.0.16
npm install react-native-safe-area-context@~5.7.0
npm install @react-native-community/cli@latest
```

---

### 2. ✅ Outdated Packages (SDK Mismatch)
**Problem:** Package versions tidak sesuai dengan Expo SDK 56
**Symptoms:**
- Warning tentang version mismatch
- Potential runtime errors

**Fixed:**
```bash
npx expo install --fix
```
**Updated:**
- `expo`: 56.0.4 → 56.0.8
- `expo-router`: 56.2.6 → 56.2.8  
- `expo-image-picker`: 56.0.14 → 56.0.15

---

### 3. ✅ Auth Loop Infinite (INITIAL_SESSION spam)
**Problem:** `INITIAL_SESSION` dipanggil berulang kali, causing infinite loop
**Symptoms:**
- Console log spam
- Performance degradation
- Possible memory leak

**Root Cause:**
- `router.replace()` dalam `onAuthStateChange` trigger component re-render
- Re-render trigger `useEffect` lagi → infinite loop

**Fixed:**
- Gunakan `useRef` untuk `hasNavigated` flag (bukan `useState`)
- Suppress log untuk `TOKEN_REFRESHED` dan `INITIAL_SESSION`
- Only navigate pada genuine auth events (`SIGNED_IN`, `SIGNED_OUT`)

**File:** `app/_layout.tsx`

---

### 4. ✅ Error Boundary Setup
**Problem:** No error boundary, errors crash entire app
**Symptoms:**
- Generic React error di console
- No user-friendly error message

**Fixed:**
- Created `lib/ErrorBoundary.tsx`
- Wrapped `<Stack>` with `<ErrorBoundary>`
- Shows user-friendly error message with "Try Again" button

---

### 5. ✅ Metro Cache Issues
**Problem:** Stale cache dari previous builds
**Symptoms:**
- Old imports still cached
- Changes tidak ter-apply setelah edit

**Fixed:**
```bash
rm -rf .expo node_modules/.cache
npx expo start --clear
```

---

### 6. ✅ Development Scripts
**Problem:** No quick commands untuk common tasks

**Added to `package.json`:**
```json
{
  "scripts": {
    "clear": "expo start --clear",
    "tunnel": "expo start --tunnel",
    "type-check": "tsc --noEmit",
    "reset": "rm -rf node_modules .expo && npm install"
  }
}
```

---

### 7. ✅ Proper .gitignore
**Problem:** No comprehensive .gitignore

**Fixed:** Added complete .gitignore untuk:
- node_modules
- .expo cache
- Metro cache
- IDE files
- Local env files
- Platform-specific files

---

## Files Modified

1. `app/_layout.tsx` - Auth loop fix + Error Boundary
2. `lib/ErrorBoundary.tsx` - NEW file
3. `package.json` - Added dev scripts
4. `.gitignore` - Complete ignore rules
5. `DEV_SETUP.md` - NEW development guide
6. `FIXES_APPLIED.md` - THIS file

---

## Current Status

### ✅ Working
- Metro Bundler running
- Dependencies installed correctly
- Error boundary active
- Auth loop fixed (using useRef)

### ⚠️ Known Issues (Non-critical)
1. **Node.js v24** - Too new for Expo SDK 56
   - **Impact:** Metro may be slower
   - **Recommended:** Use Node 18 or 20 LTS
   - **Workaround:** Works but not optimal

2. **Watchman not installed**
   - **Impact:** File watching slower, hot reload delay
   - **Fix:** `brew install watchman` (requires Homebrew)

3. **Deprecated warnings:**
   - `expo-av` deprecated → use `expo-audio`/`expo-video`
   - Shadow style props → use `boxShadow`
   - **Impact:** None (cosmetic warnings only)

---

## Next Steps

### Optional Optimizations
1. Install Watchman (requires Homebrew):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install watchman
   ```

2. Downgrade Node to v20 (if Metro is slow):
   ```bash
   brew install nvm
   nvm install 20
   nvm use 20
   npm install  # reinstall with correct Node version
   ```

3. Replace `expo-av` with `expo-audio`/`expo-video` (task #3)

---

## Testing

**Web (Fastest):**
```bash
npm run web
```

**iOS Simulator:**
```bash
npm start
# Press 'i'
```

**Android Emulator:**
```bash
npm start
# Press 'a'
```

**Real Device:**
```bash
npm run tunnel
# Scan QR with Expo Go
```

---

## Support

If Metro stuck:
1. `killall -9 node`
2. `npm run clear`

If still stuck:
1. `npm run reset`
2. Restart computer (if on macOS 12 with limited RAM)

For other issues, check `DEV_SETUP.md`
