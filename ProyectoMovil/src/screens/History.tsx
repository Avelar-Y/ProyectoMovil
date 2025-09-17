import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
// firestore namespaced import removed; use centralized service helpers instead
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getReservationsForUser, getUserProfile, getReservationsByProvider } from '../services/firestoreService';
import { useRefresh } from '../contexts/RefreshContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Chip from '../components/Chip';


export default function History({ navigation }: any) {
    const { user } = useAuth();
    const { colors } = useTheme();
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isProvider, setIsProvider] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]); // vacío = todos
    const [search, setSearch] = useState('');

    const allStatuses = ['pending','confirmed','in_progress','completed','cancelled'];
    const toggleStatus = (s: string) => {
        setSelectedStatuses(prev => {
            const next = prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s];
            AsyncStorage.setItem('historyFilters', JSON.stringify(next)).catch(()=>{});
            return next;
        });
    };
    const clearFilters = () => { setSelectedStatuses([]); AsyncStorage.removeItem('historyFilters').catch(()=>{}); };

    // load persisted filters on mount
    useEffect(() => {
        AsyncStorage.getItem('historyFilters').then(stored => {
            if (stored) {
                try { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) setSelectedStatuses(parsed); } catch {}
            }
        });
    }, []);

    const filteredReservations = useMemo(() => {
        let list = reservations;
        if (selectedStatuses.length > 0) list = list.filter(r => selectedStatuses.includes(r.status));
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter(r => (
                (r.serviceSnapshot?.title || r.service || '').toLowerCase().includes(q) ||
                (r.name || '').toLowerCase().includes(q) ||
                (r.note || '').toLowerCase().includes(q)
            ));
        }
        return list;
    }, [reservations, selectedStatuses, search]);

    // group by date (YYYY-MM-DD)
    const sections = useMemo(() => {
        const map: Record<string, any[]> = {};
        for (const r of filteredReservations) {
            let dateKey = r.date || '';
            if (!dateKey && r.createdAt?.toDate) {
                const d = r.createdAt.toDate();
                dateKey = d.toISOString().slice(0,10);
            }
            if (!dateKey) dateKey = 'Sin fecha';
            if (!map[dateKey]) map[dateKey] = [];
            map[dateKey].push(r);
        }
        const entries = Object.entries(map).map(([title, data]) => ({ title, data }));
        // sort descending by date if posible
        entries.sort((a,b) => (a.title < b.title ? 1 : -1));
        return entries;
    }, [filteredReservations]);

    const stats = useMemo(() => {
        const total = reservations.length;
        const completed = reservations.filter(r => r.status === 'completed').length;
        const cancelled = reservations.filter(r => r.status === 'cancelled').length;
        const active = reservations.filter(r => ['pending','confirmed','in_progress'].includes(r.status)).length;
        return { total, completed, cancelled, active };
    }, [reservations]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!user) {
                if (mounted) setLoading(false);
                return;
            }
            try {
                const uid = (user as any).uid;
                const profile = await getUserProfile(uid);
                if (!mounted) return;
                const provider = profile?.role === 'provider';
                setIsProvider(provider);

                let unsub = () => {};
                if (provider) {
                    // provider: load once on mount (no realtime) via service helper
                    try {
                        const items = await getReservationsByProvider(uid);
                        setReservations(items);
                        setLoading(false);
                    } catch (e) {
                        console.warn('provider reservations load failed', e);
                        setLoading(false);
                    }
                } else {
                    // regular user: existing behavior
                    try {
                        const res = await getReservationsForUser(user.email!);
                        setReservations(res);
                        setLoading(false);
                    } catch (err) {
                        console.warn('Fallback getReservationsForUser failed', err);
                        setLoading(false);
                    }
                }

                // cleanup will be handled by the return below
                return () => { try { if (typeof unsub === 'function') unsub(); } catch(_){} };
            } catch (e) {
                console.warn('History useEffect error', e);
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false };
    }, [user]);

    // register global refresh handler
    const refreshCtx = useRefresh();
    const historyRefreshHandler = React.useCallback(async () => {
        try {
            if (!user) return;
            const uid = (user as any).uid;
            const profile = await getUserProfile(uid);
            const provider = profile?.role === 'provider';
            setIsProvider(provider);
            if (provider) {
                const items = await getReservationsByProvider(uid);
                setReservations(items);
            } else {
                const res = await getReservationsForUser(user.email!);
                setReservations(res);
            }
        } catch (e) { console.warn('History global refresh failed', e); }
    }, [user]);
    React.useEffect(() => {
        const id = 'History';
        refreshCtx.register(id, historyRefreshHandler);
        return () => refreshCtx.unregister(id);
    }, [historyRefreshHandler]);

    useFocusEffect(
        useCallback(() => {
            let mounted = true;
            const load = async () => {
                if (!user?.email) return;
                try {
                    const res = await getReservationsForUser(user.email);
                    if (mounted) setReservations(res);
                } catch (err) {
                    console.warn('getReservationsForUser error on focus', err);
                }
            };
            load();
            return () => { mounted = false; };
        }, [user])
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{isProvider ? 'Historial de servicios' : 'Historial de reservas'}</Text>
                        {loading ? <Text style={{ color: colors.muted }}>Cargando...</Text> : (
                            <>
                                {/* Search bar for history */}
                                <View style={[styles.searchWrapper, { borderColor: colors.border, backgroundColor: colors.inputBg || colors.card }]}> 
                                    <TextInput
                                        value={search}
                                        onChangeText={setSearch}
                                        placeholder="Buscar (título, nombre, nota)"
                                        placeholderTextColor={colors.muted}
                                        style={{ flex:1, fontSize:13, color: colors.text }}
                                    />
                                    {!!search && (
                                        <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: colors.muted, fontSize:12 }}>Limpiar</Text></TouchableOpacity>
                                    )}
                                </View>

                                {/* Filters row */}
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical:2, paddingHorizontal:4 }} style={{ marginBottom:8 }}>
                                                        {allStatuses.map(s => {
                                                            const active = selectedStatuses.includes(s);
                                                            const labelMap: any = { pending: 'Pendiente', confirmed: 'Confirmada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' };
                                                            return <Chip key={s} label={labelMap[s] || s} active={active} onPress={() => toggleStatus(s)} variant="sm" maxWidth={150} />;
                                                        })}
                                                        {selectedStatuses.length > 0 && (
                                                            <Chip label="Limpiar" active={false} onPress={clearFilters} variant="sm" />
                                                        )}
                                </ScrollView>

                                {/* Stats */}
                                <View style={styles.statsRow}>
                                    <Stat label="Activas" value={stats.active} colors={colors} />
                                    <Stat label="Completadas" value={stats.completed} colors={colors} />
                                    <Stat label="Canceladas" value={stats.cancelled} colors={colors} />
                                    <Stat label="Total" value={stats.total} colors={colors} />
                                </View>

                                {filteredReservations.length === 0 ? (
                                    <View style={{ padding:30, alignItems:'center' }}>
                                        <Text style={{ color: colors.muted, textAlign:'center' }}>No hay reservas que coincidan con el filtro.</Text>
                                    </View>
                                ) : (
                                    <SectionList
                                        sections={sections}
                                        keyExtractor={item => item.id}
                                        stickySectionHeadersEnabled
                                        refreshing={refreshing}
                                        onRefresh={async () => {
                                            setRefreshing(true);
                                            try {
                                                if (isProvider) {
                                                    const uid = (user as any)?.uid;
                                                    if (uid) {
                                                        const docs = await getReservationsByProvider(uid);
                                                        setReservations(docs);
                                                    }
                                                } else {
                                                    if (!user?.email) return;
                                                    const res = await getReservationsForUser(user.email);
                                                    setReservations(res);
                                                }
                                            } catch (err) { console.warn('refresh error', err); } finally { setRefreshing(false); }
                                        }}
                                        renderSectionHeader={({ section }) => (
                                            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}> 
                                                <Text style={{ color: colors.muted, fontSize:12, fontWeight:'600' }}>{section.title}</Text>
                                            </View>
                                        )}
                                        renderItem={({ item }) => {
                        const status: string = item.status;
                        const statusLabelMap: any = { pending: 'Pendiente', confirmed: 'Confirmada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' };
                        const statusColor = (s: string) => {
                            switch(s){
                                case 'pending': return colors.muted;
                                case 'confirmed': return colors.accent;
                                case 'in_progress': return colors.primary;
                                case 'completed': return colors.accent;
                                case 'cancelled': return colors.danger;
                                default: return colors.muted;
                            }
                        };
                                                const isActive = ['pending','confirmed','in_progress'].includes(status);
                        const handlePress = () => {
                            if (isActive) {
                                navigation.navigate('ActiveReservationDetail', { reservationId: item.id });
                            } else {
                                navigation.navigate('ServiceDetail', { reservationId: item.id, service: item.serviceSnapshot || item.service });
                            }
                        };
                                                const faded = ['completed','cancelled'].includes(status);
                                                return (
                                                        <TouchableOpacity style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border, opacity: faded ? 0.82 : 1 }]} onPress={handlePress}>
                                <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                                    <Text style={[styles.itemTitle, { color: colors.text }]}>{item.serviceSnapshot?.title || item.service}</Text>
                                    <View style={[styles.statusChip, { backgroundColor: statusColor(status) }]}> 
                                        <Text style={{ color:'#fff', fontSize:11, fontWeight:'600' }}>{statusLabelMap[status] || status}</Text>
                                    </View>
                                </View>
                                <Text style={{ color: colors.muted }}>{item.name} - {item.date}</Text>
                                {!!item.note && <Text style={[styles.note, { color: colors.muted }]} numberOfLines={2}>{item.note}</Text>}
                                {status === 'cancelled' && !!item.cancelReason && (
                                    <Text style={{ color: colors.danger, fontSize:12, marginTop:4 }} numberOfLines={3}>Motivo: {item.cancelReason}</Text>
                                )}
                            </TouchableOpacity>
                        );
                                        }}
                                        contentContainerStyle={{ paddingBottom: 40 }}
                                    />
                                )}
                            </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f6fa' },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
    item: { padding: 12, borderRadius: 12, marginBottom: 10, borderWidth:1 },
    itemTitle: { fontWeight: '700' },
    note: { marginTop: 6 },
        statusChip: { paddingHorizontal:10, paddingVertical:4, borderRadius:12 },
        searchWrapper: { flexDirection:'row', alignItems:'center', borderWidth:1, borderRadius:12, paddingHorizontal:12, paddingVertical:6, marginBottom:6 },
        sectionHeader: { paddingHorizontal:4, paddingVertical:6 },
        statsRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:8, paddingHorizontal:4 },
        statBox: { flex:1, padding:8, borderRadius:10, marginRight:8, alignItems:'center' },
});

// Small stat component
const Stat = ({ label, value, colors }: any) => (
    <View style={[styles.statBox, { backgroundColor: colors.elevation1 || colors.highlight }]}> 
        <Text style={{ color: colors.text, fontSize:12, fontWeight:'600' }}>{value}</Text>
        <Text style={{ color: colors.muted, fontSize:10 }}>{label}</Text>
    </View>
);
