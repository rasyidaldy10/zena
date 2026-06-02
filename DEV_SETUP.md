# ZENA Development Setup

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Or specific platforms
npm run web      # Web browser
npm run ios      # iOS Simulator
npm run android  # Android Emulator
```

## Development Commands

```bash
npm run clear     # Start with cleared cache
npm run tunnel    # Start with tunnel (for testing on real device)
npm run type-check # Run TypeScript type checking
npm run reset     # Complete reset (delete node_modules, .expo, reinstall)
```

## Environment Setup

### Required
- Node.js 18 or 20 (LTS) - **Node 24 has compatibility issues**
- npm or yarn

### Recommended
- **Watchman** (makes Metro bundler 10x faster)
  ```bash
  brew install watchman
  ```

### Optional
- Xcode (for iOS development)
- Android Studio (for Android development)
- Expo Go app (for testing on real device)

## Common Issues

### Metro Bundler Slow or Stuck
- **Cause:** No Watchman installed, or Node.js v24
- **Fix:** 
  ```bash
  brew install watchman
  # OR downgrade Node to v20
  nvm install 20 && nvm use 20
  ```

### "Missing peer dependencies" Error
```bash
npx expo install --fix
```

### App Not Loading in Browser
1. Check Metro is running: `curl http://localhost:8081/status`
2. Should return: `packager-status:running`
3. If not, kill all node processes and restart:
   ```bash
   killall -9 node
   npm start
   ```

### Auth Loop / Infinite INITIAL_SESSION
- Fixed in latest version of `app/_layout.tsx`
- Uses `hasNavigated` flag to prevent routing loops

## Project Structure

```
zena/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Auth screens (login, register)
│   ├── (tabs)/            # Main tabs (home, laporan, profil, reminder)
│   ├── _layout.tsx        # Root layout with auth handling
│   └── ...                # Other screens
├── lib/                   # Utilities
│   ├── supabase.ts       # Supabase client
│   ├── scoring.ts        # Financial score engine
│   └── ErrorBoundary.tsx # Error boundary component
├── types/                 # TypeScript types
├── supabase/             # Supabase functions & migrations
└── assets/               # Images, fonts, etc.
```

## Testing

### Web (Fastest)
```bash
npm run web
```
Opens at `http://localhost:8081`

### iOS Simulator
```bash
npm start
# Then press 'i' in terminal
```

### Android Emulator
```bash
npm start
# Then press 'a' in terminal
```

### Real Device (Expo Go)
1. Install Expo Go from App Store / Play Store
2. Run `npm start`
3. Scan QR code with Expo Go app

## Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Environment Variables

Create `.env` file (already exists):
```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Debugging

### View Metro Logs
Logs appear in terminal where you ran `npm start`

### View Browser Console
Open DevTools (F12) in browser when testing web version

### React Native Debugger
Press `j` in Metro terminal to open debugger

## Git Workflow

```bash
# Check status
git status

# Commit changes
git add .
git commit -m "feat: your feature description"

# Push to remote
git push origin main
```

## Resources

- [Expo Docs](https://docs.expo.dev/)
- [Expo Router](https://expo.github.io/router/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [React Native Docs](https://reactnative.dev/)
