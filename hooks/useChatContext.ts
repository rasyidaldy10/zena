import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TransactionContext } from '../services/claudeAI';

export function useChatContext() {
  const [user, setUser] = useState<any>(null);
  const [transactionContext, setTransactionContext] = useState<TransactionContext | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchContext();
  }, [user]);

  const fetchContext = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('nama, jumlah, tipe, kategori, tanggal')
        .eq('user_id', user.id)
        .gte('tanggal', firstDay)
        .lte('tanggal', lastDay)
        .order('tanggal', { ascending: false });

      if (error) throw error;

      const pemasukan = (transactions ?? []).filter((t: any) => t.tipe === 'pemasukan').reduce((sum: number, t: any) => sum + t.jumlah, 0);
      const pengeluaran = (transactions ?? []).filter((t: any) => t.tipe === 'pengeluaran').reduce((sum: number, t: any) => sum + t.jumlah, 0);

      setTransactionContext({
        totalPemasukan: pemasukan,
        totalPengeluaran: pengeluaran,
        saldo: pemasukan - pengeluaran,
        transaksiTerakhir: (transactions ?? []).slice(0, 5).map((t: any) => ({
          nama: t.nama,
          jumlah: t.jumlah,
          kategori: t.kategori ?? 'Lainnya',
          tanggal: t.tanggal,
        })),
        bulan: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      });
    } catch (err) {
      console.error('[useChatContext]', err);
    } finally {
      setLoading(false);
    }
  };

  return { transactionContext, loading, refetch: fetchContext };
}