import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Switch, Alert, TextInput, ActivityIndicator, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { saveReservation, getUserProfile, updateUserProfile, getReservationsForUser, setAllServicesActiveForProvider } from '../services/firestoreService';
import CustomButton from '../components/CustomButton';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';

export default function Profile({ navigation }: any) {
    const { user, logout } = useAuth();
    const { colors, themeName, preference, setPreference, toggle } = useTheme();
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [editingProfile, setEditingProfile] = useState(false);
    const [originalName, setOriginalName] = useState('');
    const [originalPhone, setOriginalPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [role, setRole] = useState<'user' | 'provider'>('user');
    const [reservations, setReservations] = useState<any[]>([]);
    const [providerTermsAcceptedAt, setProviderTermsAcceptedAt] = useState<string | null>(null);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [editingAddrIndex, setEditingAddrIndex] = useState<number | null>(null);
    const [addrLabel, setAddrLabel] = useState('');
    const [addrLine, setAddrLine] = useState('');
    const [addrCity, setAddrCity] = useState('');
    const [addrProvince, setAddrProvince] = useState('');
    const [addrPostal, setAddrPostal] = useState('');
    const [addrCountry, setAddrCountry] = useState('');
    const [showAddrForm, setShowAddrForm] = useState(false);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                if (!user?.uid) return;
                const profile = await getUserProfile(user.uid);
                if (!mounted) return;
                if (profile) {
                    setName(profile.name || '');
                    setPhone(profile.phone || '');
                    setAvatarUrl(profile.avatarUrl || '');
                    setRole(profile.role === 'provider' ? 'provider' : 'user');
                    setProviderTermsAcceptedAt(profile.providerTermsAcceptedAt || null);
                    // support legacy single address or new addresses array
                    if (profile.addresses && Array.isArray(profile.addresses)) {
                        setAddresses(profile.addresses || []);
                    } else if (profile.address) {
                        setAddresses([profile.address]);
                    }
                }
                const res = await getReservationsForUser(user.email || user.uid);
                if (!mounted) return;
                setReservations(res || []);
            } catch (err) {
                console.warn('Profile load error', err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [user]);

    // register load with global refresh
    const refreshCtx = useRefresh();
    const profileRefreshHandler = React.useCallback(async () => {
        try {
            if (!user?.uid) return;
            const profile = await getUserProfile(user.uid);
            setName(profile?.name || '');
            setPhone(profile?.phone || '');
            setAvatarUrl(profile?.avatarUrl || '');
            setRole(profile?.role === 'provider' ? 'provider' : 'user');
            setProviderTermsAcceptedAt(profile?.providerTermsAcceptedAt || null);
            if (profile?.addresses && Array.isArray(profile.addresses)) setAddresses(profile.addresses || []);
            else if (profile?.address) setAddresses([profile.address]);
            const res = await getReservationsForUser(user.email || user.uid);
            setReservations(res || []);
        } catch (e) { console.warn('Profile refresh failed', e); }
    }, [user]);
    React.useEffect(() => {
        const id = 'Profile';
        refreshCtx.register(id, profileRefreshHandler);
        return () => refreshCtx.unregister(id);
    }, [profileRefreshHandler]);

    const handleSaveProfile = async () => {
        if (!user?.uid) return Alert.alert('Error', 'Usuario no encontrado');
        try {
            await updateUserProfile(user.uid, { name, phone, avatarUrl, role });
            Alert.alert('Perfil', 'Perfil actualizado correctamente');
        } catch (err: any) {
            Alert.alert('Error', err?.message || String(err));
        }
    };

    const handleAddOrUpdateAddress = async () => {
        if (!user?.uid) return Alert.alert('Error', 'Usuario no encontrado');
        const newAddr = {
            label: addrLabel || `Ubicación ${addresses.length + 1}`,
            addressLine: addrLine,
            city: addrCity,
            province: addrProvince,
            postalCode: addrPostal,
            country: addrCountry,
        };
        const updated = editingAddrIndex !== null ? addresses.map((a, i) => i === editingAddrIndex ? newAddr : a) : [...addresses, newAddr];
        try {
            await updateUserProfile(user.uid, { addresses: updated });
            setAddresses(updated);
            setShowAddrForm(false);
            setEditingAddrIndex(null);
            // clear form
            setAddrLabel(''); setAddrLine(''); setAddrCity(''); setAddrProvince(''); setAddrPostal(''); setAddrCountry('');
            Alert.alert('Listo', 'Ubicación guardada');
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo guardar la ubicación');
        }
    };

    const handleEditAddress = (index: number) => {
        const a = addresses[index];
        setEditingAddrIndex(index);
        setAddrLabel(a.label || '');
        setAddrLine(a.addressLine || '');
        setAddrCity(a.city || '');
        setAddrProvince(a.province || '');
        setAddrPostal(a.postalCode || '');
        setAddrCountry(a.country || '');
        setShowAddrForm(true);
    };

    const handleDeleteAddress = async (index: number) => {
        if (!user?.uid) return;
        const next = addresses.filter((_, i) => i !== index);
        try {
            await updateUserProfile(user.uid, { addresses: next });
            setAddresses(next);
            Alert.alert('Eliminado', 'Ubicación eliminada');
        } catch (e: any) {
            Alert.alert('Error', e?.message || 'No se pudo eliminar');
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={refreshCtx.refreshing || loading} onRefresh={async () => await refreshCtx.triggerRefresh()} />}
                >
                <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                    <Image
                        source={{ uri: avatarUrl || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                        style={styles.avatar}
                    />
                    <View style={{ flex:1, marginLeft:16 }}>
                        <Text style={[styles.email, { color: colors.text }]} numberOfLines={1}>{user?.email || 'Usuario'}</Text>
                        <View style={[styles.rolePill, { backgroundColor: colors.highlight, borderColor: colors.border }]}>
                            <Text style={{ color: colors.text, fontSize:12 }}>{role === 'provider' ? 'Proveedor' : 'Usuario'}</Text>
                        </View>
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                ) : (
                    <View style={{ marginTop: 12, width: '100%', paddingHorizontal: 0 }}>
                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>  
                        <Text style={{ color: colors.muted, marginBottom: 6 }}>Nombre</Text>
                        <TextInput editable={editingProfile} value={name} onChangeText={setName} placeholder='Nombre' placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                        <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 6 }}>Teléfono</Text>
                        <TextInput editable={editingProfile} value={phone} onChangeText={setPhone} placeholder='Teléfono' placeholderTextColor={colors.muted} keyboardType='phone-pad' style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                        {editingProfile && (
                            <>
                                <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 6 }}>Avatar URL</Text>
                                <TextInput value={avatarUrl} onChangeText={setAvatarUrl} placeholder='https://...' placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                {/* Edición de rol eliminada: ahora la activación de proveedor se hace mediante sección dedicada */}
                            </>
                        )}
                        {/* Dirección removida: ahora se usan ubicaciones guardadas en 'Ubicaciones guardadas' */}

                        <View style={{ marginTop: 12 }}>
                            {!editingProfile ? (
                                <CustomButton title="Editar perfil" onPress={() => { setOriginalName(name); setOriginalPhone(phone); setEditingProfile(true); }} variant='primary' />
                            ) : (
                                <View style={{ flexDirection: 'row' }}>
                                    <CustomButton title="Confirmar" onPress={async () => { await handleSaveProfile(); setEditingProfile(false); }} variant='primary' />
                                    <CustomButton title="Cancelar" onPress={() => { setName(originalName); setPhone(originalPhone); setEditingProfile(false); }} variant='tertiary' />
                                </View>
                            )}
                            <CustomButton title="Historial" onPress={() => navigation.navigate('History')} />
                            <CustomButton title="Cerrar sesión" onPress={async () => { try { await logout(); } catch (e) { Alert.alert('Error', 'No se pudo cerrar sesión'); console.warn('logout failed', e); } }} variant="secondary" />
                        </View>
                        </View>

                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Apariencia</Text>
                            <View style={styles.segmentRow}>
                                {(['light','dark','system'] as const).map(opt => (
                                    <TouchableOpacity key={opt} onPress={() => setPreference(opt)} style={[styles.segmentItem, { backgroundColor: preference === opt ? colors.primary : 'transparent', borderColor: colors.border }]}> 
                                        <Text style={{ color: preference === opt ? '#fff' : colors.text, fontSize:12, fontWeight:'600' }}>{opt === 'light' ? 'Claro' : opt === 'dark' ? 'Oscuro' : 'Sistema'}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity onPress={toggle} style={{ marginTop:8 }}>
                                <Text style={{ color: colors.primary, fontSize:12 }}>Alternar rápido (Light/Dark)</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Modo proveedor</Text>
                            {role === 'provider' ? (
                                <>
                                    <Text style={{ color: colors.muted, fontSize:12, marginBottom:12 }}>Tu cuenta está en modo proveedor. Puedes gestionar tus servicios y reservas desde el panel.</Text>
                                    <CustomButton title="Ir al panel" onPress={() => navigation.navigate('Main', { screen: 'Provider' })} />
                                    <CustomButton title="Salir del modo proveedor" variant='secondary' onPress={async () => {
                                        try {
                                            if (!user?.uid) return;
                                            // Desactivar todos los servicios del proveedor al salir
                                            try { await setAllServicesActiveForProvider(user.uid, false); } catch (e) { console.warn('No se pudieron desactivar todos los servicios', e); }
                                            await updateUserProfile(user.uid, { role: 'user' });
                                            setRole('user');
                                            Alert.alert('Modo proveedor', 'Has salido del modo proveedor. Puedes volver a activarlo cuando quieras.');
                                        } catch (e:any) {
                                            Alert.alert('Error', e?.message || 'No se pudo actualizar');
                                        }
                                    }} />
                                </>
                            ) : providerTermsAcceptedAt ? (
                                <>
                                    <Text style={{ color: colors.muted, fontSize:12, marginBottom:12 }}>Ya aceptaste los términos previamente. Puedes reactivar el modo proveedor directamente.</Text>
                                    <CustomButton title="Reactivar modo proveedor" onPress={async () => {
                                        try {
                                            if (!user?.uid) return;
                                            await updateUserProfile(user.uid, { role: 'provider' });
                                            setRole('provider');
                                            Alert.alert('Modo proveedor', 'Modo proveedor reactivado');
                                        } catch (e:any) { Alert.alert('Error', e?.message || 'No se pudo activar'); }
                                    }} variant='primary' />
                                </>
                            ) : (
                                <>
                                    <Text style={{ color: colors.muted, fontSize:12, marginBottom:12 }}>Activa el modo proveedor para crear servicios y administrar reservas. Primero deberás aceptar los términos.</Text>
                                    <CustomButton title="Convertirme en proveedor" onPress={() => navigation.navigate('ProviderTerms')} variant='primary' />
                                </>
                            )}
                        </View>

                        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ubicaciones guardadas</Text>
                            {addresses.length === 0 ? (
                                <Text style={{ color: colors.muted, marginTop: 8 }}>No tienes ubicaciones guardadas.</Text>
                            ) : (
                                <View>
                                    {addresses.map((item, index) => (
                                        <View key={String(index)} style={[styles.choiceRow, { backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.label || `Ubicación ${index+1}`}</Text>
                                                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.addressLine}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row' }}>
                                                <TouchableOpacity onPress={() => handleEditAddress(index)} style={{ marginRight: 12 }}><Text style={{ color: colors.primary }}>Editar</Text></TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDeleteAddress(index)}><Text style={{ color: colors.muted }}>Eliminar</Text></TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={{ marginTop: 12 }}>
                                {showAddrForm ? (
                                    <View>
                                        <TextInput placeholder='Etiqueta (Casa, Oficina)' value={addrLabel} onChangeText={setAddrLabel} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                        <TextInput placeholder='Dirección' value={addrLine} onChangeText={setAddrLine} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                        <TextInput placeholder='Ciudad' value={addrCity} onChangeText={setAddrCity} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                        <TextInput placeholder='Provincia' value={addrProvince} onChangeText={setAddrProvince} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                        <TextInput placeholder='Código postal' value={addrPostal} onChangeText={setAddrPostal} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                        <TextInput placeholder='País' value={addrCountry} onChangeText={setAddrCountry} placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                        <View style={{ flexDirection: 'row', marginTop: 8 }}>
                                            <CustomButton title={editingAddrIndex !== null ? 'Actualizar' : 'Agregar'} onPress={handleAddOrUpdateAddress} />
                                            <CustomButton title='Cancelar' onPress={() => { setShowAddrForm(false); setEditingAddrIndex(null); }} variant='tertiary' />
                                        </View>
                                    </View>
                                ) : (
                                    <CustomButton title='Agregar ubicación' onPress={() => setShowAddrForm(true)} variant='primary' />
                                )}
                            </View>

                            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                                <Text style={[styles.sectionTitle, { color: colors.text }]}>Últimas reservaciones</Text>
                                {reservations.length === 0 ? (
                                    <Text style={{ color: colors.muted, marginTop: 8 }}>No tienes reservaciones aún.</Text>
                                ) : (
                                    <View>
                                        {reservations.slice(0, 6).map((item) => (
                                            <View key={item.id} style={[styles.choiceRow, { backgroundColor: colors.card }]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name || item.service}</Text>
                                                    <Text style={{ color: colors.muted, fontSize: 12 }}>{item.date ? new Date(item.date).toLocaleString() : ''}</Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        borderRadius: 16,
        padding: 16,
        marginTop: 18,
        borderWidth: 1,
    },
    headerCard: {
        width: '100%',
        flexDirection: 'row',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center'
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        marginBottom: 12,
    },
    email: {
        fontSize: 18,
        fontWeight: '600',
        color: '#22223b',
    }
    ,
    themeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 6,
        marginVertical: 8,
    }
    ,
    input: {
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        width: '100%'
    },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    choiceRow: { padding: 12, marginVertical: 6, borderRadius: 8, width: '100%' },
    segmentRow: { flexDirection: 'row', marginTop: 4 },
    segmentItem: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, marginRight: 8, borderWidth: 1 },
    rolePill: { alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:4, borderRadius:12, marginTop:8, borderWidth:1 }
});
