import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import { WALLET_TYPE_CONFIG } from '../types'
import type { UserWallet } from '../types'
import BankConnectModal from '../components/BankConnectModal'
import { formatMoney, parseAmountInput } from '../lib/format'
import {
  BASE_CURRENCY, CURRENCIES, FOREIGN_CURRENCIES, currencyMeta,
  getRates, isForeign, spreadPercent, type FxRateMap,
} from '../lib/fx'

const PRIMARY = '#185FA5'

const WALLET_TYPES = Object.entries(WALLET_TYPE_CONFIG).map(([id, cfg]) => ({ id, ...cfg }))

const COLORS = ['#185FA5', '#534AB7', '#1D9E75', '#E24B4A', '#EF9F27', '#F0997B', '#AFA9EC', '#85B7EB']
const ICONS  = ['💵', '🏦', '💳', '📱', '🐷', '📈', '💰', '🛡️', '💎', '🏠']

export default function TambahWalletScreen() {
  const [walletName, setWalletName]     = useState('')
  const [walletType, setWalletType]     = useState('')
  const [walletFunction, setWalletFunction] = useState<'personal' | 'business'>('personal')
  const [selectedColor, setSelectedColor] = useState('#185FA5')
  const [selectedIcon, setSelectedIcon] = useState('💵')
  const [initialBalance, setInitialBalance] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBankConnect, setShowBankConnect] = useState(false)
  const [userId, setUserId] = useState('')

  // --- valas ---
  const [currency, setCurrency] = useState(BASE_CURRENCY)
  const [parentWalletId, setParentWalletId] = useState<string | null>(null)
  const [buyRate, setBuyRate] = useState('')          // kurs perolehan, dipakai hitung untung/rugi
  const [rates, setRates] = useState<FxRateMap>({})
  const [idrWallets, setIdrWallets] = useState<UserWallet[]>([])

  const foreign = isForeign(currency)
  const meta = currencyMeta(currency)

  useEffect(() => {
    loadUserId()
    getRates().then(setRates).catch(() => { /* form tetap jalan tanpa kurs */ })
  }, [])

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    // Dompet rupiah = kandidat induk buat dompet valas
    const { data } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .or(`currency.eq.${BASE_CURRENCY},currency.is.null`)
    if (data) setIdrWallets(data as UserWallet[])
  }

  // Saldo rupiah tampil bulat dengan pemisah ribuan; saldo valas perlu 2 desimal
  // (S$ 100,50) jadi koma/titik dibiarkan lewat.
  const formatBalance = (text: string) => {
    if (foreign) {
      const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '.')
      const parts = cleaned.split('.')
      setInitialBalance(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned)
      return
    }
    const nums = text.replace(/\D/g, '')
    setInitialBalance(nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
  }

  const parseBalance = (): number => parseAmountInput(initialBalance)

  const handleCurrencyChange = (code: string) => {
    setCurrency(code)
    setInitialBalance('')
    setBuyRate('')
    // Ikon default biar dompet valas langsung kelihatan beda
    if (code === BASE_CURRENCY) {
      setParentWalletId(null)
      setSelectedIcon('💵')
    } else {
      setSelectedIcon(currencyMeta(code).flag)
    }
  }

  const useTodayRate = () => {
    const rate = rates[currency]
    // Perolehan valas memakai kurs JUAL bank — itu yang kita bayar saat beli.
    if (rate?.sell) setBuyRate(String(Math.round(rate.sell * 100) / 100))
  }

  const handleBankConnect = (bankCode: string, bankName: string) => {
    notify(
      'Coming Soon! 🚀',
      `Connect ${bankName} sedang dalam tahap development.\n\nSilakan tambah wallet manual terlebih dahulu.`
    )
    // TODO: Implement OAuth flow with Brick.co
    // 1. Open getBrickAuthUrl(bankCode, userId)
    // 2. Handle callback at zena://brick-callback
    // 3. Exchange auth code for access token
    // 4. Get bank accounts
    // 5. Create wallet with bank connection
  }

  const handleSave = async () => {
    if (!walletName.trim()) {
      notify('Oops', 'Nama dompet harus diisi ya')
      return
    }
    if (!walletType) {
      notify('Oops', 'Pilih tipe / fungsi dompet dulu')
      return
    }

    // Cek jumlah wallet user saat ini per function
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Dompet valas yang nempel di rekening induk adalah sub-saldo, bukan dompet
    // baru — jadi tidak ikut memakan kuota. Tanpa ini, nambah USD+SGD+EUR ke satu
    // rekening langsung menghabiskan 3 dari 5 slot.
    const isSubWallet = foreign && !!parentWalletId

    const { count } = await supabase
      .from('user_wallets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .eq('wallet_function', walletFunction)
      .is('parent_wallet_id', null)

    const maxWallets = 5
    const walletTypeLabel = walletFunction === 'personal' ? 'pribadi' : 'bisnis'

    if (!isSubWallet && count && count >= maxWallets) {
      notify('Batas Maksimal', `Kamu hanya bisa memiliki maksimal ${maxWallets} dompet ${walletTypeLabel}. Hapus dulu salah satu dompet lama untuk menambah yang baru.`)
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const balance = parseBalance()

    // Tanpa kurs perolehan, untung/rugi tidak bisa dihitung — pakai kurs hari ini
    // sebagai titik awal supaya P/L mulai dari nol, bukan dari angka ngawur.
    const avgRate = foreign && balance > 0
      ? (parseAmountInput(buyRate) || rates[currency]?.sell || null)
      : null

    // Jaring pengaman: kurs salah ketik (mis. kelebihan/kekurangan nol) bikin
    // untung/rugi tampak ekstrem padahal saldonya benar. Lebih baik ditahan
    // di sini daripada user bingung lihat angka -99%.
    const marketRate = rates[currency]?.sell
    if (avgRate && marketRate && (avgRate > marketRate * 3 || avgRate < marketRate / 3)) {
      notify(
        'Kurs Tidak Wajar',
        `Kurs ${currency} yang kamu isi (${formatMoney(avgRate)}) jauh dari kurs hari ini (${formatMoney(marketRate)}). Cek lagi ya — atau tap "Kurs hari ini".`
      )
      setLoading(false)
      return
    }

    const { error } = await supabase.from('user_wallets').insert({
      user_id: user?.id,
      wallet_name: walletName.trim(),
      wallet_type: walletType,
      wallet_function: walletFunction,
      color: selectedColor,
      icon: selectedIcon,
      current_balance: balance,
      currency,
      parent_wallet_id: foreign ? parentWalletId : null,
      avg_buy_rate: avgRate,
      is_active: true,
    })

    if (error) {
      notify('Gagal', error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.replace('/(tabs)/profil')
    setTimeout(() => {
      notify('Berhasil! 🎉', 'Dompet baru berhasil ditambahkan')
    }, 300)
  }

  const previewBalance = parseBalance()
  const selectedType   = WALLET_TYPE_CONFIG[walletType]
  const rate           = rates[currency]
  const spread         = foreign ? spreadPercent(currency, rates) : null
  const parentWallet   = idrWallets.find((w) => w.id === parentWalletId)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Dompet</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Bank Connect Option */}
        <TouchableOpacity
          style={styles.bankConnectCard}
          onPress={() => setShowBankConnect(true)}
        >
          <View style={styles.bankConnectIcon}>
            <Text style={{ fontSize: 24 }}>🏦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bankConnectTitle}>Connect Bank Account</Text>
            <Text style={styles.bankConnectDesc}>
              Auto-sync transaksi dari 50+ bank Indonesia
            </Text>
          </View>
          <Text style={styles.bankConnectArrow}>›</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>atau tambah manual</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Preview card */}
        <View style={[styles.previewCard, { backgroundColor: selectedColor }]}>
          <Text style={styles.previewIcon}>{selectedIcon}</Text>
          <Text style={styles.previewName}>{walletName || 'Nama Dompet'}</Text>
          <Text style={styles.previewType}>{selectedType?.label || 'Tipe Dompet'}</Text>
          <Text style={styles.previewBalance}>{formatMoney(previewBalance, currency)}</Text>
          {foreign && rate?.buy && previewBalance > 0 && (
            <Text style={styles.previewSub}>
              ≈ {formatMoney(previewBalance * rate.buy)}
            </Text>
          )}
        </View>

        {/* Mata Uang */}
        <Text style={styles.label}>Mata Uang</Text>
        <View style={styles.currencyRow}>
          {[CURRENCIES.IDR, ...FOREIGN_CURRENCIES].map((c) => (
            <TouchableOpacity
              key={c.code}
              style={[styles.currencyChip, currency === c.code && styles.currencyChipActive]}
              onPress={() => handleCurrencyChange(c.code)}
            >
              <Text style={styles.currencyFlag}>{c.flag}</Text>
              <Text style={[styles.currencyCode, currency === c.code && styles.currencyCodeActive]}>
                {c.code}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {foreign && (
          <View style={styles.fxNote}>
            <Text style={styles.fxNoteText}>
              {rate
                ? `Kurs BCA hari ini — beli ${formatMoney(rate.buy)} / jual ${formatMoney(rate.sell)}${
                    spread ? ` · spread ${spread.toFixed(2)}%` : ''
                  }`
                : 'Kurs belum termuat. Dompet tetap bisa dibuat, nilai rupiahnya menyusul.'}
            </Text>
            {!!rate?.source_time && (
              <Text style={styles.fxNoteSub}>
                Diperbarui {rate.source_time}
                {rate.source === 'yahoo' ? ' · sumber kurs pasar (BCA tidak terbaca)' : ''}
              </Text>
            )}
          </View>
        )}

        {/* Nama */}
        <Text style={styles.label}>Nama Dompet</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: BCA Utama, OVO, Cash..."
          placeholderTextColor="#888780"
          value={walletName}
          onChangeText={setWalletName}
        />

        {/* Fungsi Wallet (Personal / Business) */}
        <Text style={styles.label}>Untuk Keperluan</Text>
        <View style={styles.functionToggle}>
          <TouchableOpacity
            style={[styles.functionBtn, walletFunction === 'personal' && styles.functionBtnActive]}
            onPress={() => setWalletFunction('personal')}
          >
            <Text style={[styles.functionText, walletFunction === 'personal' && styles.functionTextActive]}>
              👤 Pribadi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.functionBtn, walletFunction === 'business' && styles.functionBtnActive]}
            onPress={() => setWalletFunction('business')}
          >
            <Text style={[styles.functionText, walletFunction === 'business' && styles.functionTextActive]}>
              💼 Bisnis
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tipe / Fungsi */}
        <Text style={styles.label}>Tipe / Fungsi</Text>
        {WALLET_TYPES.map((wt) => (
          <TouchableOpacity
            key={wt.id}
            style={[styles.typeBtn, walletType === wt.id && styles.typeBtnActive]}
            onPress={() => setWalletType(wt.id)}
          >
            <Text style={styles.typeIcon}>{wt.icon}</Text>
            <View style={styles.typeInfo}>
              <Text style={[styles.typeName, walletType === wt.id && styles.typeNameActive]}>
                {wt.label}
              </Text>
              <Text style={styles.typeDesc}>{wt.desc}</Text>
            </View>
            {walletType === wt.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}

        {/* Ikon */}
        <Text style={[styles.label, { marginTop: 8 }]}>Ikon</Text>
        <View style={styles.iconGrid}>
          {ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[styles.iconBtn, selectedIcon === icon && styles.iconBtnActive]}
              onPress={() => setSelectedIcon(icon)}
            >
              <Text style={styles.iconText}>{icon}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Warna */}
        <Text style={styles.label}>Warna</Text>
        <View style={styles.colorRow}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorDot,
                { backgroundColor: color },
                selectedColor === color && styles.colorDotActive,
              ]}
              onPress={() => setSelectedColor(color)}
            />
          ))}
        </View>

        {/* Rekening induk — biar dompet valas tampil nempel di rekening yang sama */}
        {foreign && idrWallets.length > 0 && (
          <>
            <Text style={styles.label}>Nempel di Rekening</Text>
            <View style={styles.parentRow}>
              <TouchableOpacity
                style={[styles.parentChip, !parentWalletId && styles.parentChipActive]}
                onPress={() => setParentWalletId(null)}
              >
                <Text style={[styles.parentText, !parentWalletId && styles.parentTextActive]}>
                  Berdiri sendiri
                </Text>
              </TouchableOpacity>
              {idrWallets.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.parentChip, parentWalletId === w.id && styles.parentChipActive]}
                  onPress={() => setParentWalletId(w.id)}
                >
                  <Text style={[styles.parentText, parentWalletId === w.id && styles.parentTextActive]}>
                    {w.icon} {w.wallet_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              {parentWallet
                ? `Tampil sebagai sub-saldo di bawah ${parentWallet.wallet_name}, seperti rekening multi-currency.`
                : 'Dompet valas akan tampil sebagai kartu terpisah.'}
            </Text>
          </>
        )}

        {/* Saldo Awal */}
        <Text style={styles.label}>Saldo Awal</Text>
        <View style={styles.balanceWrap}>
          <Text style={styles.balancePrefix}>{meta.symbol}</Text>
          <TextInput
            style={styles.balanceInput}
            placeholder={foreign ? '0,00' : '0'}
            placeholderTextColor="#444"
            value={initialBalance}
            onChangeText={formatBalance}
            keyboardType="numeric"
          />
        </View>

        {/* Kurs perolehan — dasar hitungan untung/rugi */}
        {foreign && previewBalance > 0 && (
          <>
            <Text style={styles.label}>Kurs Waktu Dapat</Text>
            <View style={styles.rateWrap}>
              <Text style={styles.ratePrefix}>Rp</Text>
              <TextInput
                style={styles.rateInput}
                placeholder={rate?.sell ? String(Math.round(rate.sell)) : '0'}
                placeholderTextColor="#444"
                value={buyRate}
                onChangeText={(t) => setBuyRate(t.replace(/[^\d.,]/g, ''))}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.rateTodayBtn} onPress={useTodayRate}>
                <Text style={styles.rateTodayText}>Kurs hari ini</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Dipakai buat hitung untung/rugi. Kalau nggak ingat, pakai kurs hari ini —
              untung/rugi mulai dihitung dari nol.
            </Text>
          </>
        )}

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Simpan Dompet</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bank Connect Modal */}
      <BankConnectModal
        visible={showBankConnect}
        onClose={() => setShowBankConnect(false)}
        onBankSelected={handleBankConnect}
        userId={userId}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  backBtn: { width: 80 },
  backText: { fontSize: 14, color: PRIMARY },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  previewCard: {
    borderRadius: 16, padding: 20, marginTop: 20, marginBottom: 28,
    alignItems: 'center',
  },
  previewIcon: { fontSize: 32, marginBottom: 8 },
  previewName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  previewType: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  previewBalance: { fontSize: 22, fontWeight: '600', color: '#fff' },
  previewSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  currencyChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 44, borderRadius: 12,
    backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  currencyChipActive: { borderColor: PRIMARY, borderWidth: 2, backgroundColor: PRIMARY + '20' },
  currencyFlag: { fontSize: 16 },
  currencyCode: { fontSize: 14, fontWeight: '600', color: '#888780' },
  currencyCodeActive: { color: PRIMARY },
  fxNote: {
    backgroundColor: '#12202E', borderRadius: 12, padding: 12, marginBottom: 24,
    borderWidth: 1, borderColor: PRIMARY + '40',
  },
  fxNoteText: { fontSize: 12, color: '#C9D6E4', lineHeight: 18 },
  fxNoteSub: { fontSize: 11, color: '#7E8B99', marginTop: 4 },
  parentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  parentChip: {
    paddingHorizontal: 14, height: 40, justifyContent: 'center', borderRadius: 10,
    backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  parentChipActive: { borderColor: PRIMARY, borderWidth: 2, backgroundColor: PRIMARY + '20' },
  parentText: { fontSize: 13, color: '#888780' },
  parentTextActive: { color: PRIMARY, fontWeight: '600' },
  hint: { fontSize: 11, color: '#888780', lineHeight: 16, marginBottom: 24 },
  rateWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 12, paddingHorizontal: 16, marginBottom: 8,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  ratePrefix: { fontSize: 15, color: '#888780', marginRight: 8 },
  rateInput: { flex: 1, fontSize: 18, fontWeight: '600', color: '#fff', paddingVertical: 12 },
  rateTodayBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: PRIMARY + '30',
  },
  rateTodayText: { fontSize: 11, color: PRIMARY, fontWeight: '600' },
  label: {
    fontSize: 12, fontWeight: '600', color: '#888780',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    height: 48, backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 15, color: '#fff',
    borderWidth: 0.5, borderColor: '#2A2A2A', marginBottom: 24,
  },
  functionToggle: {
    flexDirection: 'row', gap: 12, marginBottom: 24,
  },
  functionBtn: {
    flex: 1, height: 48, backgroundColor: '#1A1A1A', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  functionBtnActive: {
    backgroundColor: PRIMARY + '20', borderColor: PRIMARY, borderWidth: 2,
  },
  functionText: {
    fontSize: 15, fontWeight: '600', color: '#888780',
  },
  functionTextActive: {
    color: PRIMARY,
  },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  typeBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  typeIcon: { fontSize: 22 },
  typeInfo: { flex: 1 },
  typeName: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  typeNameActive: { color: PRIMARY },
  typeDesc: { fontSize: 11, color: '#888780' },
  checkmark: { fontSize: 14, color: PRIMARY, fontWeight: '700' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  iconBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  iconText: { fontSize: 22 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  balanceWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 16, paddingHorizontal: 20, marginBottom: 28,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  balancePrefix: { fontSize: 24, color: '#888780', marginRight: 8 },
  balanceInput: { flex: 1, fontSize: 32, fontWeight: '600', color: '#fff', paddingVertical: 16 },
  bankInfoCard: {
    backgroundColor: '#0D1A2E', borderRadius: 12, padding: 16,
    marginBottom: 28, borderWidth: 1, borderColor: PRIMARY + '40',
  },
  bankInfoTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  bankInfoDesc: { fontSize: 11, color: '#888780', lineHeight: 16 },
  saveBtn: {
    height: 52, backgroundColor: PRIMARY, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bankConnectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1A2E',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PRIMARY + '60',
  },
  bankConnectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bankConnectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  bankConnectDesc: {
    fontSize: 12,
    color: '#888780',
  },
  bankConnectArrow: {
    fontSize: 24,
    color: PRIMARY,
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  dividerText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 12,
  },
})
