# LOGOUT DAN CLEAR SESSION

## Cara Logout + Clear Session:

### Option 1: Logout via Console (Paling Aman)
1. Buka https://zena-mu.vercel.app
2. Inspect → Console tab
3. Paste command ini:

```javascript
// Logout + clear session
const { supabase } = await import('/lib/supabase.js');
await supabase.auth.signOut();
console.log('✅ Logged out!');
location.reload();
```

### Option 2: Clear Browser Storage (Manual)
1. Buka https://zena-mu.vercel.app
2. Inspect → Application tab
3. Storage → Clear site data
4. Refresh page (Cmd+Shift+R)

### Option 3: Incognito Mode (Tercepat)
1. Buka Incognito/Private window
2. Buka https://zena-mu.vercel.app
3. Harusnya fresh start, no session

---

## Setelah Logout, Test Login Fresh:

1. Halaman login screen muncul
2. Klik "Masuk dengan Google"
3. Pilih account
4. Check console logs
5. Harusnya redirect ke onboarding atau dashboard

---

## Cek Session State (Debug):

Paste di console:
```javascript
const { supabase } = await import('/lib/supabase.js');
const { data } = await supabase.auth.getSession();
console.log('Current session:', data.session?.user.email || 'No session');
```
