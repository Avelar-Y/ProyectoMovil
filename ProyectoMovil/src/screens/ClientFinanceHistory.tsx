import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { listTransactionsForClient, aggregateClientStats, type Transaction } from '../services/firestoreService';

export default function ClientFinanceHistory() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const list = await listTransactionsForClient(user.uid, 200);
      setTxs(list);
      const st = await aggregateClientStats(user.uid);
      setStats(st);
    } catch (e) {
      console.warn('ClientFinanceHistory load error', e);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, [user?.uid]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
      <Text style={{ color: colors.text, fontWeight:'600' }}>{item.serviceTitle || 'Servicio'}</Text>
      <Text style={{ color: colors.muted, fontSize:12, marginTop:2 }}>Método: {item.method}</Text>
      <Text style={{ color: colors.text, fontSize:13, marginTop:4 }}>Pagaste: L {item.amountClientPaid?.toFixed?.(2)}</Text>
      <Text style={{ color: colors.muted, fontSize:11, marginTop:2 }}>Base: L {item.base?.toFixed?.(2)}  Booking: L {(item.bookingFee||0).toFixed(2)} {item.processingAmount?` Proc: L ${item.processingAmount.toFixed(2)}`:''}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Historial de Pagos</Text>
      {loading && (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {!loading && (
        <>
          <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Stat label="Pagos" value={stats?.count ?? 0} colors={colors} />
            <Stat label="Gastado" value={`L ${(stats?.totalSpent ?? 0).toFixed(2)}`} colors={colors} />
            <Stat label="Ticket Prom." value={`L ${(stats?.avgTicket ?? 0).toFixed(2)}`} colors={colors} />
          </View>
          <FlatList
            data={txs}
            keyExtractor={(i)=> i.id!}
            renderItem={renderItem}
            style={{ marginTop:12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={<Text style={{ color: colors.muted, textAlign:'center', marginTop:40 }}>Sin pagos aún.</Text>}
          />
        </>
      )}
    </View>
  );
}

const Stat = ({ label, value, colors }: any) => (
  <View style={{ marginRight:14 }}>
    <Text style={{ color: colors.muted, fontSize:11 }}>{label}</Text>
    <Text style={{ color: colors.text, fontSize:13, fontWeight:'700', marginTop:2 }}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex:1, paddingTop:40, paddingHorizontal:16 },
  title: { fontSize:18, fontWeight:'700' },
  statsBar: { flexDirection:'row', padding:14, borderRadius:16, borderWidth:1, marginTop:12 },
  txCard: { padding:14, borderRadius:14, borderWidth:1, marginBottom:10 }
});
