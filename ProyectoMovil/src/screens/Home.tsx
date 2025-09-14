import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { saveReservation } from '../services/firestoreService';
import firestore from '@react-native-firebase/firestore';
import CustomButton from '../components/CustomButton';
import CustomInput from '../components/CustomInput';
import { useTheme } from '../contexts/ThemeContext';

export default function Home({ navigation }: any) {
    const { user, logout } = useAuth();
    const { colors } = useTheme();
    const [query, setQuery] = useState('');
    const [services, setServices] = useState<Array<any>>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [testSavingId, setTestSavingId] = useState<string | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = firestore()
            .collection('services')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .onSnapshot(
                qs => {
                    const items: any[] = [];
                    qs.forEach(doc => {
                        const data: any = doc.data();
                        items.push({
                            id: doc.id,
                            key: (data.key as string) || doc.id,
                            title: data.title || data.key || 'Servicio',
                            img: data.icon || data.img || 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
                            price: data.price ? String(data.price) : '$',
                            description: data.description || data.desc || '',
                            duration: data.duration || data.time || null,
                            tags: Array.isArray(data.tags) ? data.tags : [],
                            createdAtMillis: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : null,
                            ...data,
                        });
                    });
                    setServices(items);
                    setLoadingServices(false);
                },
                err => {
                    console.warn('services onSnapshot error', err);
                    setLoadingServices(false);
                }
            );

        return () => unsubscribe();
    }, []);

    const createTestReservation = useCallback(
        async (serviceId: string, serviceTitle?: string) => {
            if (!user?.email) {
                Alert.alert('Error', 'No hay usuario logueado');
                return;
            }
            setTestSavingId(serviceId);
            try {
                const id = await saveReservation({
                    userEmail: user.email,
                    service: serviceId,
                    name: 'Reserva de prueba',
                    date: new Date().toISOString(),
                    note: `Reservado desde Home (test) - ${serviceTitle || serviceId}`,
                });
                Alert.alert('Guardado', `Reserva creada: ${id}`);
            } catch (e: any) {
                Alert.alert('Error', e?.message || String(e));
            } finally {
                setTestSavingId(null);
            }
        },
        [user]
    );

    const filteredServices = services.filter(s => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (s.title || '').toLowerCase().includes(q) || (s.key || '').toLowerCase().includes(q);
    });

    if (loadingServices) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    const renderService = ({ item }: { item: any }) => {
        const isExpanded = selected === (item.key || item.id);
        return (
            <Pressable style={[styles.choiceRow, { backgroundColor: colors.card }]} onPress={() => setSelected(isExpanded ? null : (item.key || item.id))}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Image source={{ uri: item.img }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                        <Text numberOfLines={isExpanded ? undefined : 1} style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{item.description || 'Descripción no disponible'}</Text>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8, justifyContent: 'center' }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{item.createdAtMillis ? new Date(item.createdAtMillis).toLocaleDateString() : ''}</Text>
                </View>
            </Pressable>
        );
    };

    const Header = () => (
        <>
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/565/565547.png' }} style={styles.logo} />
                    <View>
                        <Text style={[styles.smallText, { color: colors.muted }]}>Bienvenido</Text>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Servicios</Text>
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('AddService')} style={{ marginRight: 12 }}>
                        <Text style={{ fontSize: 22, color: colors.primary }}>+</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowProfile(true)}>
                        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.profileIcon} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 12 }}>
                <CustomInput type="text" value={query} title="Buscar" onChange={setQuery} />
            </View>
        </>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <FlatList
                data={filteredServices}
                keyExtractor={item => item.id || item.key}
                contentContainerStyle={styles.container}
                renderItem={renderService}
                ListHeaderComponent={Header}
                ListFooterComponent={<View style={{ height: 120 }} />}
            />

            <Modal visible={showProfile} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: colors.card }] }>
                        <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.email || 'Usuario'}</Text>
                        <View style={{ marginTop: 12 }}>
                            <Pressable onPress={() => { setShowProfile(false); }} style={styles.modalButton}><Text>Cerrar</Text></Pressable>
                            <Pressable onPress={async () => { await logout(); setShowProfile(false); }} style={[styles.modalButton, { backgroundColor: colors.primary }]}><Text style={{ color: '#fff' }}>Cerrar sesión</Text></Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={[styles.bottomBar, { backgroundColor: colors.surface }] }>
                <View style={[styles.balanceBox, { backgroundColor: colors.card }] }>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Tu balance</Text>
                    <Text style={{ color: colors.text, fontWeight: '700', marginTop: 6 }}>--</Text>
                </View>
                <View style={styles.ctaWrapper}>
                    <CustomButton title="Pedir ahora" onPress={() => navigation.navigate('ServiceDetail')} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingBottom: 180 },
    headerRow: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
    smallText: { fontSize: 12, color: '#666' },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    profileIcon: { width: 36, height: 36, borderRadius: 18 },
    choiceRow: { padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
    modalCard: { borderRadius: 12, padding: 16 },
    modalButton: { padding: 10, borderRadius: 8, marginTop: 8 },
    bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 12, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, borderRadius: 12 },
    balanceBox: { padding: 12, borderRadius: 8 },
    ctaWrapper: { flex: 1, marginLeft: 12 }
});
