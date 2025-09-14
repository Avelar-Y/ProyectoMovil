import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Modal, Pressable } from "react-native";
import { useAuth } from "../contexts/AuthContext";
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

    const [services, setServices] = useState<Array<any>>([
        // fallback static items while Firestore carga
        { key: 'plumber', title: 'Reparar fuga', price: '$', img: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png' },
        { key: 'electrician', title: 'Instalar enchufe', price: '$$', img: 'https://cdn-icons-png.flaticon.com/512/2321/2321406.png' },
        { key: 'painter', title: 'Pintura rápida', price: '$$', img: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png' },
        { key: 'clean', title: 'Limpieza express', price: '$', img: 'https://cdn-icons-png.flaticon.com/512/2913/2913496.png' },
        { key: 'mover', title: 'Ayuda con mudanza', price: '$$$', img: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' },
    ]);
    const [loadingServices, setLoadingServices] = useState(true);

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
                <TouchableOpacity onPress={() => setShowProfile(true)}>
                    <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.profileIcon} />
                </TouchableOpacity>
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
                {services.map(s => (
                    <Pressable key={s.key} style={[styles.choiceRow, { backgroundColor: colors.card }]} onPress={() => setSelected(s.key)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: s.img }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 12 }} />
                            <View>
                                <Text style={{ color: colors.text, fontWeight: '700' }}>{s.title}</Text>
                                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>Pequeña descripción o tiempo estimado</Text>
                            </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: colors.muted }}>{s.price}</Text>
                            <View style={[styles.checkCircle, selected === s.key && { backgroundColor: colors.primary }]}>
                                {selected === s.key ? <Text style={{ color: '#fff' }}>✓</Text> : null}
                            </View>
                        </View>
                    </Pressable>
                ))}
            </View>

            <View style={{ width: '100%', paddingHorizontal: 20, marginTop: 18 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Servicios recomendados</Text>
                <View style={styles.grid}>
                    {services.map(s => (
                        <TouchableOpacity key={s.key} style={[styles.gridCard, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ServiceDetail', { service: s.key })}>
                            <Image source={{ uri: s.img }} style={styles.gridImg} />
                            <Text style={[styles.gridTitle, { color: colors.text }]}>{s.title}</Text>
                            <Text style={[styles.gridPrice, { color: colors.muted }]}>{s.price}</Text>
                        </TouchableOpacity>
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