import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput } from 'react-native';
import FeatureHint from '../components/FeatureHint';
import { useTheme } from '../contexts/ThemeContext';
// firestore namespaced import removed; use centralized service helpers instead
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getReservationsForUser, getUserProfile, getReservationsByProvider } from '../services/firestoreService';
import { useRefresh } from '../contexts/RefreshContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CategoryTabs from '../components/CategoryTabs';


export default function History({ navigation }: any) {
    const { user } = useAuth();
    const { colors } = useTheme();
    const [reservations, setReservations] = useState<any[]>([]);
    // Mantiene la última lista conocida en memoria para evitar parpadeos / desapariciones
    const lastKnownRef = useRef<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isProvider, setIsProvider] = useState(false);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]); // vacío = todos
    const [search, setSearch] = useState('');

    const allStatuses = ['pending','confirmed','in_progress','completed','cancelled'];
    const labelMap: Record<string,string> = { pending: 'Pendiente', confirmed: 'Confirmada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' };
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

    // ---- Utilidades de caché serializable ----
    const CACHE_KEY = 'historyLastReservations_v1';
    const serializeForCache = (items: any[]) => {
        return items.map(r => ({
            id: r.id,
            status: r.status,
            service: r.service,
            serviceSnapshot: r.serviceSnapshot?.title ? { title: r.serviceSnapshot.title } : undefined,
            name: r.name,
            date: r.date,
            note: r.note,
            cancelReason: r.cancelReason,
            createdAt: r.createdAt?.toDate ? r.createdAt.toDate().toISOString() : r.createdAt
        }));
    };
    const restoreCache = async () => {
        try {
            const raw = await AsyncStorage.getItem(CACHE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                lastKnownRef.current = parsed;
                // Solo hidratar si todavía no hay datos (evita sobrescribir algo ya cargado en caliente)
                setReservations(prev => (prev.length === 0 ? parsed : prev));
            }
        } catch (e) { /* ignore */ }
    };
    const persistCache = async (items: any[]) => {
        try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(serializeForCache(items))); } catch(_){}
    };

    // Carga inicial (restaura caché inmediatamente y luego revalida)
    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!user) { setLoading(false); return; }
            // Restaura lista cached para evitar flash vacío
            await restoreCache();
            try {
                const uid = (user as any).uid;
                const profile = await getUserProfile(uid);
                if (!mounted) return;
                const provider = profile?.role === 'provider';
                setIsProvider(provider);

                if (provider) {
                    try {
                        const items = await getReservationsByProvider(uid);
                        if (!mounted) return;
                        setReservations(prev => (prev.length === 0 || items.length > 0 ? items : prev));
                        lastKnownRef.current = items;
                        persistCache(items);
                    } catch (e) { console.warn('provider reservations load failed', e); }
                } else {
                    try {
                        const res = await getReservationsForUser(user.email!);
                        if (!mounted) return;
                        setReservations(prev => (prev.length === 0 || res.length > 0 ? res : prev));
                        lastKnownRef.current = res;
                        persistCache(res);
                    } catch (err) { console.warn('Fallback getReservationsForUser failed', err); }
                }
            } catch (e) {
                console.warn('History useEffect error', e);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
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
                if (items.length > 0) {
                    setReservations(items);
                    lastKnownRef.current = items;
                    persistCache(items);
                } else if (lastKnownRef.current.length > 0) {
                    // mantener últimos conocidos; no sobrescribir con vacío accidental
                    console.warn('History refresh: resultado vacío, conservando cache existente (provider)');
                } else {
                    setReservations([]); // realmente vacío inicial
                }
            } else {
                const res = await getReservationsForUser(user.email!);
                if (res.length > 0) {
                    setReservations(res);
                    lastKnownRef.current = res;
                    persistCache(res);
                } else if (lastKnownRef.current.length > 0) {
                    console.warn('History refresh: resultado vacío, conservando cache existente (client)');
                } else {
                    setReservations([]);
                }
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
                if (!user) return;
                try {
                    const uid = (user as any).uid;
                    const profile = await getUserProfile(uid).catch(()=>null);
                    const provider = profile?.role === 'provider';
                    if (mounted) setIsProvider(provider);
                    if (provider) {
                        const docs = await getReservationsByProvider(uid);
                        if (mounted) {
                            setReservations(prev => (prev.length === 0 || docs.length > 0 ? docs : prev));
                            lastKnownRef.current = docs;
                            persistCache(docs);
                        }
                    } else if (user.email) {
                        const res = await getReservationsForUser(user.email);
                        if (mounted) {
                            setReservations(prev => (prev.length === 0 || res.length > 0 ? res : prev));
                            lastKnownRef.current = res;
                            persistCache(res);
                        }
                    }
                } catch (err) {
                    console.warn('History focus load error', err);
                }
            };
            load();
            return () => { mounted = false; };
        }, [user])
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>{isProvider ? 'Historial de servicios' : 'Historial de reservas'}</Text>
            <FeatureHint id="history_filters" title="Filtra y analiza" text="Usa las etiquetas para filtrar estados, busca por texto y revisa estadísticas rápidas para entender tu actividad." />
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

                                {/* Filters tabs (multi-select) */}
                                <CategoryTabs
                                    categories={allStatuses.map(s => labelMap[s] || s)}
                                    values={selectedStatuses.map(s => labelMap[s] || s)}
                                    onToggle={(label) => {
                                        // revert label to status key
                                        const entry = Object.entries(labelMap).find(([k,v]) => v === label);
                                        const statusKey = entry ? entry[0] : label; // fallback
                                        toggleStatus(statusKey);
                                    }}
                                    scrollEnabled
                                    uppercase={false}
                                />
                                {selectedStatuses.length > 0 && (
                                    <TouchableOpacity onPress={clearFilters} style={{ alignSelf:'flex-end', marginTop:4, marginBottom:4 }}>
                                        <Text style={{ color: colors.primary, fontSize:12, fontWeight:'600' }}>Limpiar filtros</Text>
                                    </TouchableOpacity>
                                )}

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
                                                        if (docs.length > 0) {
                                                            setReservations(docs);
                                                            lastKnownRef.current = docs;
                                                            persistCache(docs);
                                                        } else if (lastKnownRef.current.length > 0) {
                                                            console.warn('History pull-to-refresh vacío, preservando lista anterior (provider)');
                                                        } else {
                                                            setReservations([]);
                                                        }
                                                    }
                                                } else {
                                                    if (!user?.email) return;
                                                    const res = await getReservationsForUser(user.email);
                                                    if (res.length > 0) {
                                                        setReservations(res);
                                                        lastKnownRef.current = res;
                                                        persistCache(res);
                                                    } else if (lastKnownRef.current.length > 0) {
                                                        console.warn('History pull-to-refresh vacío, preservando lista anterior (client)');
                                                    } else {
                                                        setReservations([]);
                                                    }
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
                            const paymentStatus = item.paymentStatus;
                            const isClient = !isProvider; // historial ya distingue rol
                            const needsPaymentAuth = isClient && status === 'completed' && paymentStatus !== 'paid';
                            if (isActive) {
                                navigation.navigate('ActiveReservationDetail', { reservationId: item.id });
                            } else if (needsPaymentAuth) {
                                // Abrir detalle activo para botón Autorizar pago
                                navigation.navigate('ActiveReservationDetail', { reservationId: item.id });
                            } else if (['completed','cancelled'].includes(status)) {
                                navigation.navigate('ReservationSummary', { reservationId: item.id });
                            } else {
                                navigation.navigate('ServiceDetail', { reservationId: item.id, service: item.serviceSnapshot || item.service });
                            }
                        };
                                                const faded = ['completed','cancelled'].includes(status);
                                                const isClient = !isProvider;
                                                const paymentStatus = item.paymentStatus;
                                                const showPendingPaymentBadge = isClient && status === 'completed' && paymentStatus !== 'paid';
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
                                {showPendingPaymentBadge && (
                                    <View style={{ marginTop:6, alignSelf:'flex-start', backgroundColor: colors.accent, paddingHorizontal:8, paddingVertical:4, borderRadius:8 }}>
                                        <Text style={{ color:'#fff', fontSize:11, fontWeight:'600' }}>Pendiente de pago</Text>
                                    </View>
                                )}
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
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
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
