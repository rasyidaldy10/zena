# ZENA Logo Update Guide

## 🎨 Current Status

**Current Icon:** Default Expo template (letter "A" in blue)  
**Status:** ❌ **MUST BE REPLACED** before production

---

## 📋 Required Assets

### 1. **App Icon** (1024x1024px)
- **File:** `assets/icon.png`
- **Format:** PNG with transparency
- **Size:** 1024x1024 pixels
- **Usage:** Main app icon for iOS/Android

### 2. **Adaptive Icon (Android)**
- **Foreground:** `assets/android-icon-foreground.png` (1024x1024px)
- **Background:** `assets/android-icon-background.png` (1024x1024px)
- **Monochrome:** `assets/android-icon-monochrome.png` (1024x1024px)

### 3. **Favicon** (Web)
- **File:** `assets/favicon.png`
- **Size:** 48x48 pixels
- **Format:** PNG

### 4. **Splash Screen Icon**
- **File:** `assets/splash-icon.png`
- **Size:** 1242x2436 pixels (iPhone 11 Pro Max)
- **Usage:** Shown while app loading

---

## 🎯 Logo Design Requirements

### Brand Identity: ZENA
- **Name:** ZENA (ZEN + Financial Assistant)
- **Tagline:** "Keuanganmu, selaras."
- **Brand Colors:**
  - Primary: `#185FA5` (Blue)
  - Accent: Purple gradient
  - Background: `#F4F7FA` (Light gray-blue)

### Logo Concept Ideas:

#### Option 1: Letter "Z" + Finance Symbol
- Modern "Z" lettermark
- Integrated with money/coin icon
- Gradient blue → purple

#### Option 2: Zen Circle + Coin
- Zen enso circle (mindfulness)
- Coin in center
- Minimalist, clean

#### Option 3: Abstract Balance
- Abstract scales (balance)
- Flowing, zen-like curves
- Blue gradient

### Style Guidelines:
- ✅ Modern & minimalist
- ✅ Professional (finance app)
- ✅ Calming (zen philosophy)
- ✅ Memorable & unique
- ❌ Avoid: Too complex, childish, generic

---

## 🛠️ How to Create Logo

### Method 1: Professional Designer (Recommended)
1. Hire designer on Fiverr/Upwork
2. Budget: $20-50
3. Provide:
   - App name: ZENA
   - Tagline: "Keuanganmu, selaras"
   - Brand colors: #185FA5 primary
   - Style: Modern, minimalist, finance + zen
   - Deliverables: 1024x1024 PNG with transparency

### Method 2: AI Generator
1. Use Midjourney/DALL-E
2. Prompt example:
   ```
   "Modern minimalist logo for finance app called ZENA,
   letter Z with zen circle, blue gradient #185FA5,
   clean professional design, transparent background,
   1024x1024"
   ```

### Method 3: Canva/Figma
1. Use Canva Pro templates
2. Search "app icon finance"
3. Customize with "Z" letter
4. Export 1024x1024 PNG

---

## 📦 How to Apply New Logo

### Step 1: Prepare Assets
Place files in `assets/` folder:
```
assets/
├── icon.png              (1024x1024 - main icon)
├── favicon.png           (48x48 - web)
├── splash-icon.png       (1242x2436 - splash)
├── android-icon-foreground.png  (1024x1024)
├── android-icon-background.png  (1024x1024)
└── android-icon-monochrome.png  (1024x1024)
```

### Step 2: Update app.json
```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "backgroundColor": "#0F0F0F"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png",
        "backgroundColor": "#E6F4FE"
      }
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

### Step 3: Clear Cache & Rebuild
```bash
rm -rf .expo node_modules/.cache
npx expo start --clear
```

### Step 4: Test
- Web: Check favicon in browser tab
- iOS: Check icon in simulator
- Android: Check adaptive icon

---

## 🎨 Quick Fix: Text-Based Logo (Temporary)

For immediate testing, create simple text logo:

### Using ImageMagick:
```bash
# Install ImageMagick
brew install imagemagick

# Generate temporary logo
convert -size 1024x1024 xc:'#185FA5' \
  -gravity center \
  -pointsize 600 -font Arial-Bold \
  -fill white \
  -annotate +0+0 'Z' \
  assets/icon-temp.png
```

### Or use online tools:
1. Go to https://appicon.co/
2. Upload any Z logo image
3. Generate all sizes automatically
4. Download and replace

---

## ✅ Pre-Launch Checklist

Before submitting to stores:

- [ ] Custom logo created (not default Expo icon)
- [ ] All asset sizes generated (1024x1024, adaptive icons, etc)
- [ ] Logo matches brand colors (#185FA5)
- [ ] Logo visible & clear at small sizes (48x48)
- [ ] Logo has transparent background
- [ ] Splash screen looks good
- [ ] Favicon shows in web browser
- [ ] No copyright issues (own the design)

---

## 🚨 IMPORTANT

**DO NOT launch with default Expo icon!**
- Play Store/App Store will reject
- Looks unprofessional
- Copyright issues (Expo logo)

**Minimum Required:**
- Custom `icon.png` (1024x1024)
- Custom foreground/background for Android
- Custom favicon for web

---

## 📞 Need Help?

### Design Resources:
- Fiverr: https://fiverr.com (search "app icon design")
- 99designs: https://99designs.com
- Canva: https://canva.com (templates)
- IconScout: https://iconscout.com

### Testing:
```bash
# Preview icon in development
npx expo start

# Build with custom icon
eas build --platform android
```

---

**Status:** ⚠️ **LOGO UPDATE REQUIRED**  
**Priority:** 🔴 **HIGH** (before Play Store/App Store submission)  
**ETA:** 1-3 days (depending on designer availability)
