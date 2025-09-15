import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getReservationsForUser, getUserProfile } from '../services/firestoreService';


export default function History({ navigation }: any) {
    const { user } = useAuth();
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isProvider, setIsProvider] = useState(false);

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
                    // provider: listen reservations where providerId == uid
                    try {
                        unsub = firestore().collection('reservations').where('providerId', '==', uid).orderBy('createdAtClient', 'desc').onSnapshot(qs => {
                            const items: any[] = [];
                            qs.forEach(d => {
                                const data = d.data();
                                if (!data.createdAtClient && data.createdAt && data.createdAt.toMillis) data.createdAtClient = data.createdAt.toMillis();
                                items.push({ id: d.id, ...(data as any) });
                            });
                            setReservations(items);
                            setLoading(false);
                        }, err => {
                            console.warn('provider reservations listener failed', err);
                            setLoading(false);
                        });
                    } catch (e) {
                        console.warn('provider reservations listener setup failed', e);
                        setLoading(false);
                    }
                } else {
                    // regular user: existing behavior
                    try {
                        unsub = firestore().collection('reservations').where('userEmail', '==', user.email).orderBy('createdAtClient', 'desc').onSnapshot(qs => {
                            const items: any[] = [];
                            qs.forEach(d => {
                                const data = d.data();
                                if (!data.createdAtClient && data.createdAt && data.createdAt.toMillis) data.createdAtClient = data.createdAt.toMillis();
                                items.push({ id: d.id, ...(data as any) });
                            });
                            setReservations(items);
                            setLoading(false);
                        }, async err => {
                            console.warn('reservations onSnapshot error', err);
                            try {
                                const res = await getReservationsForUser(user.email!);
                                setReservations(res);
                            } catch (e) {
                                console.warn('Fallback getReservationsForUser also failed', e);
                            }
                            setLoading(false);
                        });
                    } catch (err) {
                        console.warn('Error setting up reservations listener, using fallback', err);
                        (async () => {
                            try {
                                const res = await getReservationsForUser(user.email!);
                                setReservations(res);
                            } catch (e) {
                                console.warn('Fallback getReservationsForUser failed', e);
                            } finally {
                                setLoading(false);
                            }
                        })();
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
            {loading ? <Text>Cargando...</Text> : (
                <FlatList
                    data={reservations}
                    keyExtractor={item => item.id}
                    refreshing={refreshing}
                    onRefresh={async () => {
                        setRefreshing(true);
                        try {
                            if (isProvider) {
                                const uid = (user as any)?.uid;
                                if (uid) {
                                    // fallback: query provider reservations once
                                    const snap = await firestore().collection('reservations').where('providerId', '==', uid).orderBy('createdAtClient', 'desc').get();
                                    const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
                                    setReservations(docs);
                                }
                            } else {
                                if (!user?.email) return;
                                const res = await getReservationsForUser(user.email);
                                setReservations(res);
                            }
                        } catch (err) {
                            console.warn('refresh error', err);
                        } finally {
                            setRefreshing(false);
                        }
                    }}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('ServiceDetail', { reservationId: item.id, service: item.serviceSnapshot || item.service })}>
                            <Text style={styles.itemTitle}>{item.serviceSnapshot?.title || item.service}</Text>
                            <Text>{item.name} - {item.date}</Text>
                            <Text style={styles.note}>{item.note}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f6fa' },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
    item: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
    itemTitle: { fontWeight: '700' },
    note: { marginTop: 6, color: '#555' }
});
