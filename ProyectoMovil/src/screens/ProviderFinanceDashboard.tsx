import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { listTransactionsForProvider, aggregateProviderStats, type Transaction } from '../services/firestoreService';

export default function ProviderFinanceDashboard() {
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
      const list = await listTransactionsForProvider(user.uid, 200);
      setTxs(list);
      const st = await aggregateProviderStats(user.uid);
      setStats(st);
    } catch (e) {
      console.warn('ProviderFinanceDashboard load error', e);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, [user?.uid]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
      <Text style={{ color: colors.text, fontWeight:'600' }}>{item.serviceTitle || 'Servicio'}</Text>
      <Text style={{ color: colors.muted, fontSize:12, marginTop:2 }}>Método: {item.method}  ·  Cliente paga: L {item.amountClientPaid?.toFixed?.(2)}</Text>
      <Text style={{ color: colors.text, fontSize:13, marginTop:4 }}>Recibes: L {item.providerReceives?.toFixed?.(2)}</Text>
      {!!item.bookingFee && <Text style={{ color: colors.muted, fontSize:11, marginTop:2 }}>Booking: L {item.bookingFee.toFixed(2)}</Text>}
      {!!item.processingAmount && <Text style={{ color: colors.muted, fontSize:11 }}>Procesamiento: L {item.processingAmount.toFixed(2)}</Text>}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Finanzas Proveedor</Text>
      {loading && (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      )}
      {!loading && (
        <>
          <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Stat label="Servicios" value={stats?.count ?? 0} colors={colors} />
            <Stat label="Bruto" value={`L ${(stats?.gross ?? 0).toFixed(2)}`} colors={colors} />
            <Stat label="Recibes" value={`L ${(stats?.providerReceives ?? 0).toFixed(2)}`} colors={colors} />
            <Stat label="App (fees)" value={`L ${(stats?.netToApp ?? 0).toFixed(2)}`} colors={colors} />
          </View>
          <FlatList
            data={txs}
            keyExtractor={(i)=> i.id!}
            renderItem={renderItem}
            style={{ marginTop:12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={<Text style={{ color: colors.muted, textAlign:'center', marginTop:40 }}>Sin transacciones aún.</Text>}
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
