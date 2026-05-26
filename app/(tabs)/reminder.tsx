import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { Reminder } from '../../types'

const PRIMARY = '#185FA5'

export default function ReminderScreen() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchReminders = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user?.id)
      .order('due_date', { ascending: true })

    if (data) setReminders(data)
    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchReminders() }, []))

  const handleAdd = async () => {
    if (!title || !dueDate) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('reminders').insert({
      user_id: user?.id,
      title,
      amount: parseFloat(amount.replace(/\./g, '')) || 0,
      due_date: dueDate,
      is_paid: false,
    })
    setTitle('')
    setAmount('')
    setDueDate('')
    setShowForm(false)
    fetchReminders()
    setSaving(false)
  }

  const handleTogglePaid = async (id: string, isPaid: boolean) => {
    await supabase.from('reminders').update({ is_paid: !isPaid }).eq('id', id)
    fetchReminders()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('reminders').delete().eq('id', id)
    fetchReminders()
  }

  const getDaysUntil = (dateStr: string) => {
    const today = new Date()
    const due = new Date(dateStr)
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { label: 'Terlambat', color: '#E24B4A' }
    if (diff === 0) return { label: 'Hari ini!', color: '#BA7517' }
    if (diff <= 3) return { label: `${diff} hari lagi`, color: '#BA7517' }
    return { label: `${diff} hari lagi`, color: '#888780' }
  }

  const formatRupiah = (amount: number) =>
    amount > 0 ? 'Rp ' + amount.toLocaleString('id-ID') : '-'

  const unpaid = reminders.filter(r => !r.is_paid)
  const paid = reminders.filter(r => r.is_paid)

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reminder</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowForm(!showForm)}
        >
          <Text style={styles.addBtnText}>{showForm ? '✕' : '+ Tambah'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nama tagihan... (contoh: Listrik PLN)"
            placeholderTextColor="#888780"
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Nominal (opsional)"
              placeholderTextColor="#888780"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Tanggal (YYYY-MM-DD)"
              placeholderTextColor="#888780"
              value={dueDate}
              onChangeText={setDueDate}
            />
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, (!title || !dueDate) && styles.saveBtnDisabled]}
            onPress={handleAdd}
            disabled={!title || !dueDate || saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>Simpan Reminder</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {unpaid.length === 0 && paid.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>Belum ada reminder</Text>
              <Text style={styles.emptySub}>Tambah tagihan yang perlu diingatkan</Text>
            </View>
          ) : (
            <>
              {unpaid.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Belum dibayar ({unpaid.length})</Text>
                  {unpaid.map(r => {
                    const days = getDaysUntil(r.due_date)
                    return (
                      <View key={r.id} style={styles.reminderItem}>
                        <TouchableOpacity
                          style={styles.checkbox}
                          onPress={() => handleTogglePaid(r.id, r.is_paid)}
                        />
                        <View style={styles.reminderInfo}>
                          <Text style={styles.reminderTitle}>{r.title}</Text>
                          <View style={styles.reminderMeta}>
                            <Text style={styles.reminderDate}>{r.due_date}</Text>
                            <Text style={[styles.reminderDays, { color: days.color }]}>
                              {days.label}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.reminderRight}>
                          {r.amount > 0 && (
                            <Text style={styles.reminderAmount}>{formatRupiah(r.amount)}</Text>
                          )}
                          <TouchableOpacity onPress={() => handleDelete(r.id)}>
                            <Text style={styles.deleteBtn}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}

              {paid.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Sudah dibayar ({paid.length})</Text>
                  {paid.map(r => (
                    <View key={r.id} style={[styles.reminderItem, styles.reminderPaid]}>
                      <TouchableOpacity
                        style={[styles.checkbox, styles.checkboxDone]}
                        onPress={() => handleTogglePaid(r.id, r.is_paid)}
                      >
                        <Text style={styles.checkboxCheck}>✓</Text>
                      </TouchableOpacity>
                      <View style={styles.reminderInfo}>
                        <Text style={[styles.reminderTitle, styles.reminderTitlePaid]}>{r.title}</Text>
                        <Text style={styles.reminderDate}>{r.due_date}</Text>
                      </View>
                      <TouchableOpacity onPress={() => handleDelete(r.id)}>
                        <Text style={styles.deleteBtn}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#fff' },
  addBtn: {
    backgroundColor: PRIMARY, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  addBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  form: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: '#1A1A1A', borderRadius: 14,
    padding: 14, gap: 10,
  },
  formRow: { flexDirection: 'row', gap: 10 },
  input: {
    height: 44, backgroundColor: '#0F0F0F', borderRadius: 10,
    paddingHorizontal: 12, fontSize: 13, color: '#fff',
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  saveBtn: {
    height: 44, backgroundColor: PRIMARY, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#2A2A2A' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reminderItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, marginBottom: 8,
  },
  reminderPaid: { opacity: 0.5 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: '#888780', flexShrink: 0,
  },
  checkboxDone: {
    backgroundColor: '#1D9E75', borderColor: '#1D9E75',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxCheck: { fontSize: 12, color: '#fff', fontWeight: '700' },
  reminderInfo: { flex: 1 },
  reminderTitle: { fontSize: 14, fontWeight: '500', color: '#fff', marginBottom: 4 },
  reminderTitlePaid: { textDecorationLine: 'line-through', color: '#888780' },
  reminderMeta: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  reminderDate: { fontSize: 12, color: '#888780' },
  reminderDays: { fontSize: 12, fontWeight: '500' },
  reminderRight: { alignItems: 'flex-end', gap: 6 },
  reminderAmount: { fontSize: 13, fontWeight: '600', color: '#fff' },
  deleteBtn: { fontSize: 14, color: '#888780', padding: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#fff', fontWeight: '500', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#888780' },
})