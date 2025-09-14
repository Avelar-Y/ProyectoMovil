import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getReservationsForUser } from '../services/firestoreService';

export default function History({ navigation }: any) {
    const { user } = useAuth();
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!user?.email) return;
            try {
                const res = await getReservationsForUser(user.email);
                setReservations(res);
            } catch (err) {
                console.warn(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Historial de reservas</Text>
            {loading ? <Text>Cargando...</Text> : (
                <FlatList
                    data={reservations}
                    keyExtractor={item => item.id}
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
