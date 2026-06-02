#!/bin/bash

# =========================================
# ZENA Logo Update Script
# =========================================
# Run this after placing logo file

echo "🎨 ZENA Logo Update Script"
echo "=================================="

# Check if logo source exists
LOGO_SOURCE="$1"

if [ -z "$LOGO_SOURCE" ]; then
  echo "❌ Usage: ./UPDATE_LOGO_NOW.sh <path-to-logo.png>"
  echo ""
  echo "Example:"
  echo "  ./UPDATE_LOGO_NOW.sh ~/Desktop/zena-logo.png"
  exit 1
fi

if [ ! -f "$LOGO_SOURCE" ]; then
  echo "❌ File not found: $LOGO_SOURCE"
  exit 1
fi

echo "✅ Logo source found: $LOGO_SOURCE"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
  echo "⚠️  ImageMagick not installed"
  echo "Installing via Homebrew..."
  brew install imagemagick
fi

echo ""
echo "📦 Generating app icons..."

# Create assets directory if not exists
mkdir -p assets

# 1. Main app icon (1024x1024)
echo "  → icon.png (1024x1024)"
convert "$LOGO_SOURCE" -resize 1024x1024 -gravity center -background transparent -extent 1024x1024 assets/icon.png

# 2. Favicon (48x48)
echo "  → favicon.png (48x48)"
convert "$LOGO_SOURCE" -resize 48x48 assets/favicon.png

# 3. Splash icon (1242x2436)
echo "  → splash-icon.png (1242x2436)"
convert "$LOGO_SOURCE" -resize 1024x1024 -gravity center -background "#0F0F0F" -extent 1242x2436 assets/splash-icon.png

# 4. Android adaptive icon - foreground (1024x1024)
echo "  → android-icon-foreground.png (1024x1024)"
convert "$LOGO_SOURCE" -resize 768x768 -gravity center -background transparent -extent 1024x1024 assets/android-icon-foreground.png

# 5. Android adaptive icon - background (1024x1024)
echo "  → android-icon-background.png (1024x1024)"
convert -size 1024x1024 xc:"#E6F4FE" assets/android-icon-background.png

# 6. Android adaptive icon - monochrome (1024x1024)
echo "  → android-icon-monochrome.png (1024x1024)"
convert "$LOGO_SOURCE" -colorspace Gray -resize 1024x1024 -gravity center -background transparent -extent 1024x1024 assets/android-icon-monochrome.png

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Clear cache: rm -rf .expo node_modules/.cache"
echo "2. Restart: npm start --clear"
echo "3. Check icon in app"
echo ""
echo "🚀 Icons are now ready for production build!"
