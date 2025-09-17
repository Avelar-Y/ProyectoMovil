import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Switch, Alert, TextInput, ActivityIndicator, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { saveReservation, getUserProfile, updateUserProfile, getReservationsForUser } from '../services/firestoreService';
import CustomButton from '../components/CustomButton';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';

export default function Profile({ navigation }: any) {
    const { user, logout } = useAuth();
    const { colors, themeName, toggle } = useTheme();
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [editingProfile, setEditingProfile] = useState(false);
    const [originalName, setOriginalName] = useState('');
    const [originalPhone, setOriginalPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [role, setRole] = useState<'user' | 'provider'>('user');
    const [reservations, setReservations] = useState<any[]>([]);
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
                <Image
                    source={{ uri: avatarUrl || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                    style={styles.avatar}
                />
                <Text style={[styles.email, { color: colors.text }]}>{user?.email || 'Usuario'}</Text>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                ) : (
                    <View style={{ marginTop: 12, width: '100%', paddingHorizontal: 20 }}>
                        <Text style={{ color: colors.muted, marginBottom: 6 }}>Nombre</Text>
                        <TextInput editable={editingProfile} value={name} onChangeText={setName} placeholder='Nombre' placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                        <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 6 }}>Teléfono</Text>
                        <TextInput editable={editingProfile} value={phone} onChangeText={setPhone} placeholder='Teléfono' placeholderTextColor={colors.muted} keyboardType='phone-pad' style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                        {editingProfile && (
                            <>
                                <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 6 }}>Avatar URL</Text>
                                <TextInput value={avatarUrl} onChangeText={setAvatarUrl} placeholder='https://...' placeholderTextColor={colors.muted} style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                                <Text style={{ color: colors.muted, marginTop: 8, marginBottom: 6 }}>Tipo de cuenta</Text>
                                <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                                    <TouchableOpacity onPress={() => setRole('user')} style={{ marginRight: 12 }}><Text style={{ color: role === 'user' ? colors.primary : colors.muted }}>Usuario</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => setRole('provider')}><Text style={{ color: role === 'provider' ? colors.primary : colors.muted }}>Proveedor</Text></TouchableOpacity>
                                </View>
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

                        <View style={{ marginTop: 18 }}>
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

                            <View style={{ marginTop: 18 }}>
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
});
