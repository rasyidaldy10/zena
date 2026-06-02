# 🏦 ZENA - Personal Finance Management

**Tagline:** Keuanganmu, selaras.

AI-powered personal finance app with multi-wallet management, intelligent insights, and beautiful UX inspired by Livin'.

---

## ✨ **Features**

### **Core**
- 💰 Multi-wallet management (unlimited wallets)
- 📊 Transaction tracking (income/expense/transfer)
- 📈 Monthly reports with budget tracking
- 🤖 AI chat assistant (6 personas, 4 languages)
- 🧠 ZENA Intelligence (6 autonomous agents)
- 🔔 Smart notifications & alerts
- 📱 Beautiful, intuitive UI

### **AI-Powered**
- Context-aware financial advice
- Receipt OCR (scan struk)
- Budget monitoring
- Anomaly detection
- Weekly insights
- Daily summaries

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18 or 20 (NOT 24!)
- npm or yarn
- Expo account (free)

### **Installation**

```bash
# Clone
git clone [repo-url]
cd zena

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env dengan Supabase keys

# Run development server
npm start
```

### **First Time Setup**

1. **Create Supabase Project** (https://supabase.com)
2. **Get credentials:**
   - EXPO_PUBLIC_SUPABASE_URL
   - EXPO_PUBLIC_SUPABASE_ANON_KEY
3. **Apply RLS migration:** Run `supabase/migrations/000_initial_schema_rls.sql` in Supabase SQL Editor
4. **Deploy Edge Functions:**
   ```bash
   supabase functions deploy chat
   supabase functions deploy budget-monitor
   # etc...
   ```

---

## 📱 **Development**

### **Commands**

```bash
npm start              # Start Expo dev server
npm run web            # Start web mode
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run type-check     # TypeScript check
npm run clear          # Clear cache & restart
npm run reset          # Complete reset (reinstall)
```

### **Project Structure**

```
zena/
├── app/                 # Screens (Expo Router)
│   ├── (auth)/         # Login, register
│   ├── (tabs)/         # Main navigation
│   └── _layout.tsx     # Root layout
├── lib/                # Utilities
├── types/              # TypeScript types
├── assets/             # Images, icons
├── supabase/
│   ├── migrations/     # SQL migrations
│   └── functions/      # Edge Functions
└── docs/               # Documentation
```

---

## 🏗️ **Production Build**

### **Build APK/IPA**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build preview (testing)
eas build --platform android --profile preview

# Build production (store)
eas build --platform android --profile production
```

### **OTA Updates (Instant!)**

```bash
# Deploy update (users get it in 1-5 minutes!)
eas update --branch production --message "Fix bug X"
```

---

## 📚 **Documentation**

| File | Description |
|------|-------------|
| `AGENTS.md` | Development log & feature status |
| `DEPLOYMENT_CHECKLIST.md` | Pre-deploy checklist |
| `PRODUCTION_BUILD_GUIDE.md` | Build & OTA guide |
| `MAINTENANCE_GUIDE.md` | Long-term maintenance |
| `SECURITY_AUDIT.md` | Security analysis |
| `APP_COMPLETENESS_REVIEW.md` | Feature gaps & roadmap |
| `ERROR_ANALYSIS.md` | Debugging guide |
| `DEV_SETUP.md` | Development setup |

---

## 🔒 **Security**

### **CRITICAL: Apply RLS Migration**

Before deployment, **MUST** run:

```sql
-- In Supabase SQL Editor
-- File: supabase/migrations/000_initial_schema_rls.sql
```

Without RLS, **any user can access any other user's data!**

See `SECURITY_AUDIT.md` for complete security analysis.

---

## 🎨 **Tech Stack**

- **Frontend:** React Native (Expo SDK 56)
- **Backend:** Supabase (PostgreSQL, Auth, Functions)
- **AI:** Claude API (Anthropic)
- **Deployment:** EAS Build + OTA Updates
- **Hosting:** Vercel (web), Expo (mobile)
- **Language:** TypeScript

---

## 🤝 **Contributing**

### **Development Workflow**

1. Fork & clone
2. Create feature branch
3. Make changes
4. Test locally
5. Submit PR

### **Code Standards**

- TypeScript strict mode
- No `console.log` in production
- Comment only when WHY is non-obvious
- Follow existing patterns

---

## 📊 **Status**

**Current Version:** 1.0.0 (Pre-Production)

**Completeness:** 92%
- ✅ Core features: 100%
- ✅ UI/UX: 95%
- ✅ AI features: 95%
- ⚠️ Security: 85% (needs RLS applied)

**Production Ready:** ✅ YES (after RLS migration)

---

## 🗺️ **Roadmap**

### **V1.0 (Now)**
- All core features
- Multi-wallet
- AI chat
- ZENA Intelligence
- Production ready

### **V1.1 (1 month)**
- Gmail auto-import
- Full reminder system
- PDF export

### **V1.5 (3 months)**
- In-app purchase
- Pro/Business tiers
- Premium features

### **V2.0 (6 months)**
- Savings goals
- Leaderboard
- Voice features
- Couple mode
- Multi-currency

---

## 📄 **License**

[Your License]

---

## 🆘 **Support**

- **Issues:** [GitHub Issues]
- **Email:** [Support Email]
- **Docs:** Check `/docs` folder

---

## 🙏 **Acknowledgments**

Built with:
- [Expo](https://expo.dev)
- [Supabase](https://supabase.com)
- [Claude AI](https://anthropic.com)
- [React Native](https://reactnative.dev)

---

## 📝 **Changelog**

### **V1.0.0** (2026-06-XX)
- Initial release
- Multi-wallet management
- Transaction tracking
- Monthly reports
- AI chat (6 personas, 4 languages)
- ZENA Intelligence (6 agents)
- Smart notifications
- Budget tracking
- Financial score & tier system

---

**Made with ❤️ for better financial wellness**

🌟 **Star this repo if you find it useful!**
