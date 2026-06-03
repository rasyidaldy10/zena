# Groq API Setup Guide

## 🎯 **What is Groq?**

Groq provides **ultra-fast AI inference** for voice transcription and text processing.

**Used in Zena for:**
- 🎤 Voice Note transcription (Whisper Large V3)
- 📝 Transaction parsing from voice (Mixtral 8x7b)

**Why Groq?**
- ⚡ **10x faster** than OpenAI Whisper
- 💰 **Cheaper** than Claude for simple tasks
- 🎯 **Specialized** for voice & structured output

---

## 📋 **Setup Steps**

### **1. Get Groq API Key**

1. Go to https://console.groq.com
2. Sign up / Login
3. Navigate to **API Keys**
4. Click **Create API Key**
5. Copy key (starts with `gsk_...`)

---

### **2. Add to Local .env**

```bash
# Add to /Users/rasyid/Desktop/zena/.env
GROQ_API_KEY=gsk_your_actual_key_here
```

**⚠️ IMPORTANT:** Never commit actual key to Git!

---

### **3. Add to Supabase Secrets**

```bash
# Via Supabase CLI
supabase secrets set GROQ_API_KEY=gsk_your_actual_key_here

# Or via Supabase Dashboard:
# Settings → Edge Functions → Secrets → Add GROQ_API_KEY
```

---

### **4. Deploy Edge Functions**

```bash
# Deploy Groq functions to Supabase
cd /Users/rasyid/Desktop/zena

supabase functions deploy groq-transcribe
supabase functions deploy groq-parse-transaction
```

---

### **5. Test Voice Note**

1. Open app → AI Chat
2. Tap **🎤 microphone button**
3. Say: _"Beli nasi goreng 25 ribu"_
4. Tap **⏹ stop**
5. Should see:
   ```
   🎤 Voice Note:
   "Beli nasi goreng 25 ribu"
   
   Terdeteksi:
   💰 Nominal: Rp 25.000
   📂 Kategori: Makanan
   📝 Catatan: Beli nasi goreng
   ```

---

## 🔧 **Hybrid AI Architecture**

### **Groq (Fast & Cheap):**
- Voice transcription
- Simple text parsing
- Structured data extraction

### **Claude (Smart & Contextual):**
- Chat conversations
- Receipt OCR
- Financial analysis
- Budget insights
- Weekly summaries

---

## 💰 **Cost Comparison**

| Task | Groq | Claude | Savings |
|------|------|--------|---------|
| Voice transcription (1 min) | $0.00005 | $0.005 | **100x cheaper** |
| Parse transaction | $0.0001 | $0.001 | **10x cheaper** |
| Chat message | N/A | $0.001 | (Claude better) |
| Receipt OCR | N/A | $0.003 | (Claude Vision) |

**Strategy:** Use Groq for simple tasks, Claude for complex reasoning.

---

## 📊 **Voice Note Flow**

```
User taps 🎤
  ↓
Record audio (expo-av)
  ↓
Convert to base64
  ↓
Send to groq-transcribe Edge Function
  ↓
Groq Whisper API → Text
  ↓
Send to groq-parse-transaction Edge Function
  ↓
Groq Mixtral → Structured JSON
  ↓
Display parsed result to user
```

---

## 🐛 **Troubleshooting**

### **Error: "GROQ_API_KEY not configured"**
→ Add key to Supabase secrets (Step 3)

### **Error: "Failed to transcribe"**
→ Check audio format (should be m4a/mp4)
→ Check file size (<25MB)

### **Voice button doesn't appear**
→ Check expo-av installed: `npm list expo-av`
→ Restart Metro bundler

### **Transcription always empty**
→ Check microphone permissions
→ Test with longer audio (>2 seconds)

---

## 🔐 **Security Notes**

- ✅ API key stored server-side (Supabase Edge Functions)
- ✅ Never exposed to client
- ✅ Audio data sent via HTTPS
- ✅ No audio stored (processed & deleted)

---

## 📝 **Models Used**

### **Whisper Large V3**
- Best accuracy for Indonesian
- 10x faster than OpenAI
- Supports 99+ languages

### **Mixtral 8x7b**
- Fast structured output
- JSON mode guaranteed
- Low hallucination rate

---

## 🚀 **Future Improvements**

1. **Batch processing** - Handle multiple voice notes
2. **Speaker identification** - Multi-user support
3. **Background transcription** - Process while user continues
4. **Offline mode** - Cache transcriptions

---

**Setup complete! Voice Note sekarang powered by Groq AI!** 🎉
