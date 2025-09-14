import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getReservationsForUser } from '../services/firestoreService';

export default function History({ navigation }: any) {
    const { user } = useAuth();
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            return;
        }
        // Intentamos suscripción ordenada; si falla por índice, usamos getReservationsForUser como fallback
        let unsub = () => {};
        try {
            unsub = firestore()
                .collection('reservations')
                .where('userEmail', '==', user.email)
                .orderBy('createdAtClient', 'desc')
                .onSnapshot(qs => {
                    const items: any[] = [];
                    qs.forEach(d => {
                        const data = d.data();
                        if (!data.createdAtClient && data.createdAt && data.createdAt.toMillis) {
                            data.createdAtClient = data.createdAt.toMillis();
                        }
                        items.push({ id: d.id, ...(data as any) });
                    });
                    setReservations(items);
                    setLoading(false);
                }, async err => {
                    console.warn('reservations onSnapshot error', err);
                    // Fallback: consultar vía getReservationsForUser
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

        return () => {
            try {
                if (typeof unsub === 'function') unsub();
            } catch (e) {
                // noop
            }
        };
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
            <Text style={styles.title}>Historial de reservas</Text>
            {loading ? <Text>Cargando...</Text> : (
                <FlatList
                    data={reservations}
                    keyExtractor={item => item.id}
                    refreshing={refreshing}
                    onRefresh={async () => {
                        if (!user?.email) return;
                        setRefreshing(true);
                        try {
                            const res = await getReservationsForUser(user.email);
                            setReservations(res);
                        } catch (err) {
                            console.warn('refresh error', err);
                        } finally {
                            setRefreshing(false);
                        }
                    }}
                    renderItem={({ item }) => (
                        <View style={styles.item}>
                            <Text style={styles.itemTitle}>{item.service}</Text>
                            <Text>{item.name} - {item.date}</Text>
                            <Text style={styles.note}>{item.note}</Text>
                        </View>
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
