import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Modal, Pressable, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { saveReservation } from '../services/firestoreService';
import firestore from '@react-native-firebase/firestore';
import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import { useTheme } from "../contexts/ThemeContext";

export default function Home({ navigation }: any) {
    const { user, logout } = useAuth();
    const { colors } = useTheme();
    const [query, setQuery] = useState('');

    const categories = [
        { id: '1', title: 'Fontanería', icon: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png' },
        { id: '2', title: 'Electricidad', icon: 'https://cdn-icons-png.flaticon.com/512/2321/2321406.png' },
        { id: '3', title: 'Pintura', icon: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png' },
        { id: '4', title: 'Limpieza', icon: 'https://cdn-icons-png.flaticon.com/512/2913/2913496.png' },
        { id: '5', title: 'Mudanzas', icon: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' },
    ];

    const [services, setServices] = useState<Array<any>>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [testSavingId, setTestSavingId] = useState<string | null>(null);

    useEffect(() => {
        // Suscripción en tiempo real a la colección 'services'
        const unsubscribe = firestore()
            .collection('services')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .onSnapshot(querySnapshot => {
                const items: any[] = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
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
            }, error => {
                console.warn('services onSnapshot error', error);
                setLoadingServices(false);
            });

        return () => unsubscribe();
    }, []);

    const createTestReservation = async (serviceId: string, serviceTitle?: string) => {
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
                note: `Reservado desde Home (test) - ${serviceTitle || serviceId}`
            });
            Alert.alert('Guardado', `Reserva creada: ${id}`);
        } catch (err: any) {
            Alert.alert('Error', err?.message || String(err));
        } finally {
            setTestSavingId(null);
        }
    }

    const [showProfile, setShowProfile] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={[styles.container]}>
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/565/565547.png' }} style={styles.logo} />
                    <View>
                        <Text style={[styles.smallText, { color: colors.muted }]}>Bienvenido</Text>
                        <Text style={[styles.headerTitle, { color: colors.text }]}>Servicios Rápidos</Text>
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
                <CustomInput type="text" value={query} title="Buscar servicio o profesional" onChange={setQuery} />
            </View>

            <View style={{ marginTop: 18 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Categorías populares</Text>
                <FlatList
                    data={categories}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={[styles.categoryCard, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ServiceDetail', { service: item.title })}>
                            <Image source={{ uri: item.icon }} style={styles.catIcon} />
                            <Text style={[styles.catTitle, { color: colors.text }]}>{item.title}</Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            {/* Featured / My bet style cards */}
            <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Destacado</Text>
                <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                    <View style={[styles.featureBig, { backgroundColor: colors.primary }]}> 
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>Oferta</Text>
                        <Text style={{ color: '#fff', marginTop: 8, fontSize: 22 }}>Servicio Premium</Text>
                        <Text style={{ color: '#fff', marginTop: 10, fontSize: 14 }}>Desde 0.25</Text>
                    </View>
                    <View style={[styles.featureSmall, { backgroundColor: colors.card }]}> 
                        <Text style={{ color: colors.muted }}>Fecha</Text>
                        <Text style={{ color: colors.text, marginTop: 8 }}>Hoy • 14:00</Text>
                    </View>
                </View>

                <View style={[styles.metricsRow, { backgroundColor: colors.card }] }>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Mi resumen</Text>
                    <Text style={{ color: colors.muted }}>Pedidos: 24 • Valoraciones: 4.8</Text>
                </View>
            </View>

            {/* Choices list (selectable) */}
            <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 12 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Tu elección</Text>
                {loadingServices ? (
                    <View style={{ padding: 20 }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={services.filter(s => {
                            if (!query) return true;
                            const q = query.toLowerCase();
                            return (s.title || '').toLowerCase().includes(q) || (s.key || '').toLowerCase().includes(q);
                        })}
                        keyExtractor={item => item.id || item.key}
                        renderItem={({ item }) => {
                            const isExpanded = selected === (item.key || item.id);
                            return (
                                <Pressable style={[styles.choiceRow, { backgroundColor: colors.card }]} onPress={() => setSelected(isExpanded ? null : (item.key || item.id))}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <Image source={{ uri: item.img }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
                                            <Text numberOfLines={isExpanded ? undefined : 1} style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{item.description || 'Descripción no disponible'}</Text>
                                            <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center' }}>
                                                {item.duration ? <Text style={{ color: colors.muted, fontSize: 12, marginRight: 10 }}>⏱ {item.duration} min</Text> : null}
                                                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.price ? `${item.price}` : ''}</Text>
                                            </View>
                                            {isExpanded && item.tags && item.tags.length > 0 ? (
                                                <View style={{ flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' }}>
                                                    {item.tags.map((t: any, idx: number) => (
                                                        <View key={idx} style={[styles.tagChip, { backgroundColor: colors.background, borderColor: colors.muted }]}>
                                                            <Text style={{ fontSize: 11, color: colors.muted }}>{String(t)}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : null}
                                            {isExpanded && (
                                                <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                                                    <TouchableOpacity onPress={() => navigation.navigate('ServiceDetail', { service: item })} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary }}>
                                                        <Text style={{ color: '#fff' }}>Ver detalle</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => createTestReservation(item.key || item.id, item.title)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary }}>
                                                        <Text style={{ color: '#fff' }}>Reservar</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', marginLeft: 8, justifyContent: 'center' }}>
                                        <Text style={{ color: colors.muted, fontSize: 12 }}>{item.createdAtMillis ? new Date(item.createdAtMillis).toLocaleDateString() : ''}</Text>
                                        {!isExpanded && (testSavingId === (item.key || item.id) ? (
                                            <ActivityIndicator style={{ marginTop: 6 }} />
                                        ) : (
                                            <TouchableOpacity onPress={() => createTestReservation(item.key || item.id, item.title)} style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.primary }}>
                                                <Text style={{ color: '#fff', fontSize: 12 }}>Prueba</Text>
                                            </TouchableOpacity>
                                        ))}
                                        <View style={[styles.checkCircle, selected === (item.key || item.id) && { backgroundColor: colors.primary, marginTop: 8 }]}>
                                            {selected === (item.key || item.id) ? <Text style={{ color: '#fff' }}>✓</Text> : null}
                                        </View>
                                    </View>
                                </Pressable>
                            );
                        }}
                    />
                )}
            </View>

            <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 18 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Servicios recomendados</Text>
                <View style={styles.grid}>
                    {services.slice(0, 6).map((s: any) => (
                        <View key={s.key || s.id} style={[styles.gridCard, { backgroundColor: colors.card }] }>
                            <TouchableOpacity style={{ alignItems: 'center', width: '100%' }} onPress={() => navigation.navigate('ServiceDetail', { service: s.key || s.id })}>
                                <Image source={{ uri: s.img }} style={styles.gridImg} />
                                <Text style={[styles.gridTitle, { color: colors.text }]}>{s.title}</Text>
                                <Text style={[styles.gridPrice, { color: colors.muted }]}>{s.price}</Text>
                                {s.duration ? <Text style={{ color: colors.muted, marginTop: 6, fontSize: 12 }}>Duración: {s.duration} min</Text> : null}
                                {s.tags && s.tags.length > 0 ? <Text style={{ color: colors.muted, marginTop: 6, fontSize: 11 }}>{s.tags.slice(0,2).join(', ')}</Text> : null}
                            </TouchableOpacity>
                            <View style={{ marginTop: 8, width: '100%', alignItems: 'center' }}>
                                {testSavingId === (s.key || s.id) ? (
                                    <ActivityIndicator />
                                ) : (
                                    <TouchableOpacity onPress={() => createTestReservation(s.key || s.id, s.title)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary }}>
                                        <Text style={{ color: '#fff', fontSize: 13 }}>Reservar prueba</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            </View>

            <View style={{ marginTop: 24, width: '100%', paddingHorizontal: 20, marginBottom: 40 }}>
                <CustomButton title="Solicitar servicio ahora" onPress={() => navigation.navigate('ServiceDetail')} />
            </View>
        </ScrollView>

            {/* Profile modal */}
            <Modal visible={showProfile} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: colors.card }] }>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.modalAvatar} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={{ color: colors.text, fontWeight: '700' }}>{user?.email || 'Usuario'}</Text>
                                <Text style={{ color: colors.muted, marginTop: 4 }}>360 pedidos • 117 valoraciones</Text>
                            </View>
                        </View>

                        <View style={{ marginTop: 14 }}>
                            <Text style={{ color: colors.muted, marginBottom: 8 }}>Tu balance</Text>
                            <View style={[styles.balanceRow, { backgroundColor: colors.background }] }>
                                <Text style={{ fontWeight: '700', color: colors.text }}>8.32</Text>
                            </View>
                        </View>

                        <View style={{ marginTop: 16 }}>
                            <Pressable style={styles.modalItem} onPress={() => { /* navegar a Transacciones */ }}>
                                <Text style={{ color: colors.text }}>Transacciones</Text>
                            </Pressable>
                            <Pressable style={styles.modalItem} onPress={() => { /* navegar a Picks */ }}>
                                <Text style={{ color: colors.text }}>Picks</Text>
                            </Pressable>
                            <Pressable style={styles.modalItem} onPress={() => { navigation.navigate('Profile') }}>
                                <Text style={{ color: colors.text }}>Ajustes</Text>
                            </Pressable>
                            <Pressable style={styles.modalItem} onPress={() => { /* help */ }}>
                                <Text style={{ color: colors.text }}>Ayuda</Text>
                            </Pressable>
                        </View>

                        <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Pressable onPress={() => { setShowProfile(false); }} style={styles.modalButton}><Text>Cerrar</Text></Pressable>
                            <Pressable onPress={async () => { await logout(); setShowProfile(false); }} style={[styles.modalButton, { backgroundColor: colors.primary }]}><Text style={{ color: '#fff' }}>Cerrar sesión</Text></Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Sticky bottom bar */}
            <View style={[styles.bottomBar, { backgroundColor: colors.surface }] }>
                <View style={[styles.balanceBox, { backgroundColor: colors.card }] }>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Tu balance</Text>
                    <Text style={{ color: colors.text, fontWeight: '700', marginTop: 6 }}>8.32</Text>
                </View>
                <View style={styles.ctaWrapper}>
                    <CustomButton title="Pedir ahora" onPress={() => navigation.navigate('ServiceDetail')} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 40,
        paddingTop: 18,
        flexGrow: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    logo: { width: 44, height: 44, marginRight: 12 },
    profileIcon: { width: 40, height: 40, borderRadius: 20 },
    smallText: { fontSize: 12 },
    headerTitle: { fontSize: 20, fontWeight: '700' },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 12, marginBottom: 8 },
    categoryCard: { marginHorizontal: 8, padding: 12, borderRadius: 12, alignItems: 'center', width: 110, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
    catIcon: { width: 36, height: 36, marginBottom: 8 },
    catTitle: { fontSize: 13, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridCard: { width: '48%', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center' },
    gridImg: { width: 56, height: 56, marginBottom: 8 },
    gridTitle: { fontSize: 15, fontWeight: '700' },
    gridPrice: { marginTop: 4 },
    featureBig: { flex: 1, borderRadius: 12, padding: 14, marginRight: 10 },
    featureSmall: { width: 110, borderRadius: 12, padding: 12, alignItems: 'center' },
    metricsRow: { marginTop: 12, padding: 12, borderRadius: 10 },
    choiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 10 },
    checkCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    tagChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginRight: 6, marginBottom: 6 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modalCard: { padding: 18, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    modalAvatar: { width: 56, height: 56, borderRadius: 28 },
    modalItem: { paddingVertical: 12 },
    modalButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },
    balanceRow: { padding: 12, borderRadius: 10 },
    bottomBar: { position: 'absolute', left: 12, right: 12, bottom: 12, height: 72, borderRadius: 14, flexDirection: 'row', alignItems: 'center', padding: 10, elevation: 6 },
    balanceBox: { flex: 0.6, padding: 10, borderRadius: 10, alignItems: 'flex-start' },
    ctaWrapper: { flex: 0.4, alignItems: 'flex-end' },
});