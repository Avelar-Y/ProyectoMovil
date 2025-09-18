import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TextInput, Alert, ActivityIndicator, ScrollView, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';
import CustomButton from '../components/CustomButton';
import { useAuth } from '../contexts/AuthContext';
import { saveReservation, getReservationsForService, getUserProfile, updateUserProfile, getOrCreateThread, appendReservationEvent } from '../services/firestoreService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ServiceDetail({ route, navigation }: any) {
    const { service } = route.params || { service: null };
    // name field removed from form: we'll use authenticated profile name or email
    const [date, setDate] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerDate, setPickerDate] = useState<Date>(new Date());
    const [note, setNote] = useState('');
    const [addressLine, setAddressLine] = useState('');
    const [city, setCity] = useState('');
    const [province, setProvince] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('');
    const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
    const [loadingReservations, setLoadingReservations] = useState(false);
    const [reservations, setReservations] = useState<any[]>([]);
    const [addressCollapsed, setAddressCollapsed] = useState(true);
    const [profile, setProfile] = useState<any | null>(null);
    const [serviceOwner, setServiceOwner] = useState<any | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!service) return;
            setLoadingReservations(true);
            try {
                const idOrKey = service.id || service.key || service;
                const res = await getReservationsForService(idOrKey);
                if (mounted) setReservations(res || []);
                try {
                    if (service.ownerId) {
                        const so = await getUserProfile(service.ownerId);
                        if (mounted) setServiceOwner(so || null);
                    } else if (service.ownerPhone || service.ownerDisplayName) {
                        if (mounted) setServiceOwner({ phone: service.ownerPhone, displayName: service.ownerDisplayName });
                    }
                } catch (e) { console.warn('Could not load service owner', e); }
            } catch (err) { console.warn('Could not load reservations for service', err); }
            finally { if (mounted) setLoadingReservations(false); }
        };
        load();
        // Prefill user profile if authenticated
        (async () => {
            try {
                const uid = (user as any)?.uid;
                    if (uid) {
                    const p = await getUserProfile(uid);
                    setProfile(p || null);
                    if (p) {
                        // previously we prefixed the 'name' input with profile.displayName; input removed
                        // If user has addresses array, pick first by default
                                if (p.addresses && Array.isArray(p.addresses) && p.addresses.length > 0) {
                            const a = p.addresses[0];
                            setSelectedAddressIndex(0);
                            setAddressLine(a.addressLine || '');
                            setCity(a.city || '');
                            setProvince(a.province || '');
                            setPostalCode(a.postalCode || '');
                            setCountry(a.country || '');
                            setAddressCollapsed(true);
                        } else if (p.address) {
                            const a = p.address as any;
                            if (a.addressLine) setAddressLine(a.addressLine);
                            if (a.city) setCity(a.city);
                            if (a.province) setProvince(a.province);
                            if (a.postalCode) setPostalCode(a.postalCode);
                            if (a.country) setCountry(a.country);
                            setAddressCollapsed(true);
                        }
                    }
                }
            } catch (e) {
                console.warn('prefill profile failed', e);
            }
            // cargar dirección local guardada si no hay perfil
            if (!profile && !(user as any)?.uid) {
                try {
                    const raw = await AsyncStorage.getItem('@localAddress');
                    if (raw) {
                        const a = JSON.parse(raw);
                        setAddressLine(a.addressLine||'');
                        setCity(a.city||'');
                        setProvince(a.province||'');
                        setPostalCode(a.postalCode||'');
                        setCountry(a.country||'');
                        setAddressCollapsed(true);
                    }
                } catch {}
            }
        })();
        return () => { mounted = false };
    }, [service]);

    // register refresh handler so global pull-to-refresh reloads reservations and owner info
    const refreshCtx = useRefresh();
    const serviceDetailHandler = React.useCallback(async () => {
        try {
            if (!service) return;
            const idOrKey = service.id || service.key || service;
            const res = await getReservationsForService(idOrKey);
            setReservations(res || []);
            if (service.ownerId) {
                const so = await getUserProfile(service.ownerId);
                setServiceOwner(so || null);
            }
        } catch (e) { console.warn('ServiceDetail global refresh failed', e); }
    }, [service]);
    React.useEffect(() => {
        const id = `ServiceDetail-${service?.id || service?.key || String(service)}`;
        refreshCtx.register(id, serviceDetailHandler);
        return () => refreshCtx.unregister(id);
    }, [serviceDetailHandler]);

    const handleReserve = async () => {
        // Bloqueo inmediato si servicio no activo
        if (!service?.active) {
            Alert.alert('No disponible', 'Este servicio está inactivo y no se puede reservar.');
            return;
        }
        if (!date) {
            Alert.alert('Error', 'Por favor completa la fecha');
            return;
        }

        // Enforce at least one saved location for authenticated users
        const uid = (user as any)?.uid;
        if (uid) {
            const hasSavedAddresses = profile && Array.isArray(profile.addresses) && profile.addresses.length > 0;
            if (!hasSavedAddresses) {
                Alert.alert(
                    'Falta ubicación',
                    'Debes agregar al menos una ubicación en tu perfil antes de reservar.',
                    [
                        // Profile is a screen inside the Main tab navigator - navigate to Main and select Profile
                        { text: 'Agregar ahora', onPress: () => navigation.navigate('Main', { screen: 'Profile' }) },
                        { text: 'Cancelar', style: 'cancel' }
                    ]
                );
                return;
            }
        } else {
            // For non-authenticated users, require filling at least the address line in the form
            if (!addressLine) {
                Alert.alert('Falta dirección', 'Debes especificar la dirección de destino.');
                return;
            }
        }
        try {
            const serviceId = service?.id || service?.key || service;
            const amount = service?.price ?? undefined;
            const currency = 'USD';

            // Permitir que proveedores reserven servicios de otros, el bloqueo se maneja sólo si es su propio servicio (ya implementado arriba).

            const computedName = (profile && profile.displayName) ? profile.displayName : (user?.email ?? 'Cliente');

            // Bloqueo de auto-reserva: si el usuario autenticado es el dueño del servicio
            try {
                const uidCurrent = (user as any)?.uid;
                if (uidCurrent && (service.ownerId === uidCurrent || serviceOwner?.uid === uidCurrent)) {
                    Alert.alert('No permitido', 'No puedes reservar tu propio servicio.');
                    return;
                }
            } catch {}

            const reservationData: any = {
                userEmail: user?.email ?? 'unknown',
                userId: (user as any)?.uid,
                service: serviceId,
                serviceSnapshot: { id: service?.id, title: service?.title, price: service?.price },
                // include provider info with the reservation so chat/flows can reference it
                providerId: service?.ownerId || serviceOwner?.uid || undefined,
                providerPhone: service?.ownerPhone || serviceOwner?.phone || undefined,
                providerDisplayName: service?.ownerDisplayName || serviceOwner?.displayName || undefined,
                name: computedName,
                date,
                note,
                address: {
                    addressLine: addressLine || undefined,
                    city: city || undefined,
                    province: province || undefined,
                    postalCode: postalCode || undefined,
                    country: country || undefined,
                },
                amount,
                currency,
                paymentStatus: 'unpaid',
                status: 'pending',
            };

            const id = await saveReservation(reservationData);
            // Crear/obtener thread conversacional único cliente <-> proveedor y añadir evento reserva
            try {
                const clientId = (user as any)?.uid;
                const providerId = reservationData.providerId;
                if (clientId && providerId) {
                    const threadId = await getOrCreateThread(clientId, providerId, {
                        [clientId]: { displayName: reservationData.name },
                        [providerId]: { displayName: reservationData.providerDisplayName }
                    });
                    await appendReservationEvent(threadId, { reservationId: id, snapshot: reservationData.serviceSnapshot, status: 'pending' });
                }
            } catch (e) { console.warn('No se pudo anexar evento de reserva al thread', e); }
            // Auto-save address in profile if this is the first time (profile exists but had no address)
            try {
                const uidInner = (user as any)?.uid;
                if (uidInner && (!profile || !profile.address)) {
                    await updateUserProfile(uidInner, { address: reservationData.address });
                    // update local profile state so UI reflects change
                    setProfile({ ...(profile || {}), address: reservationData.address });
                }
            } catch (e) {
                console.warn('Could not auto-save address to profile', e);
            }

            Alert.alert('Reservado', `Reserva creada: ${id}`);
            navigation.goBack();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo guardar la reserva');
        }
    }

    if (!service) {
        return (
            <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:24 }}>
                <Text style={styles.title}>Servicio no encontrado</Text>
            </View>
        );
    }

    const { colors } = useTheme();

    return (
    <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <View style={[styles.sheet, { backgroundColor: colors.card }]}>
                <View style={styles.sheetHandle} />
                <View style={styles.modalHeader}>
                    <Text style={[styles.title, { color: colors.text, flex:1 }]} numberOfLines={1}>{service.title || service.key || 'Servicio'}</Text>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
                        <Text style={{ color: colors.primary, fontWeight: '700' }}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View style={styles.headerRow}>
                    <Image source={{ uri: service.icon || 'https://cdn-icons-png.flaticon.com/512/854/854878.png' }} style={styles.image} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: colors.muted, marginTop: 6 }}>{service.key || service.id || '-'}</Text>
                    </View>
                </View>

                {/* Provider info block (shows provider name, phone and call action) */}
                {(serviceOwner || service.ownerDisplayName || service.ownerPhone) ? (
                    <View style={[styles.providerRow, { borderColor: colors.border, backgroundColor: colors.card, padding: 10, borderRadius: 8, marginTop: 10 }] }>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Image source={{ uri: serviceOwner?.avatarUrl || service.ownerAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.ownerAvatar} />
                            <View style={{ marginLeft: 10, flex: 1 }}>
                                <Text style={{ fontWeight: '700', color: colors.text }}>{serviceOwner?.displayName || service.ownerDisplayName || 'Proveedor'}</Text>
                                { (serviceOwner?.phone || service.ownerPhone) ? (
                                    <Text style={{ color: colors.muted }}>{serviceOwner?.phone || service.ownerPhone}</Text>
                                ) : null }
                            </View>
                            {/* Call action removed: chat will be enabled when provider accepts the reservation (providers manage reservations in "Mis servicios"). */}
                        </View>
                    </View>
                ) : null}

                <Text style={[styles.desc, { color: colors.text }]}>{service.description || 'Descripción no disponible'}</Text>

                <View style={styles.metaRow}>
                    <View>
                        <Text style={[styles.fieldLabel, { color: colors.muted }]}>Precio</Text>
                        <Text style={{ color: colors.text }}>{service.price ? String(service.price) : 'No especificado'}</Text>
                    </View>
                    <View>
                        <Text style={[styles.fieldLabel, { color: colors.muted }]}>Duración</Text>
                        <Text style={{ color: colors.text }}>{service.duration ? `${service.duration} min` : 'No especificado'}</Text>
                    </View>
                    <View>
                        <Text style={[styles.fieldLabel, { color: colors.muted }]}>Activo</Text>
                        <Text style={{ color: colors.text }}>{service.active ? 'Sí' : 'No'}</Text>
                    </View>
                </View>

                {service.tags && service.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                        {service.tags.map((t: any, i: number) => (
                            <View key={i} style={[styles.tag, { borderColor: colors.primary }]}> 
                                <Text style={{ color: colors.primary }}>{String(t)}</Text>
                            </View>
                        ))}
                    </View>
                )}
                <View style={{ marginTop: 12 }}>
                                {/* Input de nombre eliminado: usaremos el displayName del perfil o el email al crear la reserva */}
                                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, justifyContent: 'center' }] }>
                                    <Text style={{ color: date ? colors.text : colors.muted }}>{date || 'Selecciona una fecha'}</Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={pickerDate}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        onChange={(event: any, selected?: Date | undefined) => {
                                            const d = selected || pickerDate;
                                            setShowDatePicker(Platform.OS === 'ios');
                                            setPickerDate(d as Date);
                                            // format YYYY-MM-DD
                                            const y = d.getFullYear();
                                            const m = String(d.getMonth() + 1).padStart(2, '0');
                                            const day = String(d.getDate()).padStart(2, '0');
                                            setDate(`${y}-${m}-${day}`);
                                        }}
                                    />
                                )}
                                <TextInput placeholder="Nota adicional" value={note} onChangeText={setNote} style={[styles.input, { height: 80, backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} multiline placeholderTextColor={colors.muted} />

                    <Text style={[styles.fieldLabel, { color: colors.muted, marginTop: 8 }]}>Dirección de destino</Text>
                    {/* Summary collapsed block */}
                    {addressCollapsed && (addressLine || city || province || country) ? (
                        <TouchableOpacity onPress={() => setAddressCollapsed(false)} style={[styles.addressSummary, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                            <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{addressLine || 'Dirección'}</Text>
                            <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{[city, province, country].filter(Boolean).join(', ')}</Text>
                            <Text style={{ color: colors.primary, marginTop: 4 }}>Editar</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                        {profile?.addresses && Array.isArray(profile.addresses) && profile.addresses.length > 0 ? (
                            <View>
                                <Text style={{ color: colors.muted, marginBottom: 6 }}>Usar una dirección guardada</Text>
                                {profile.addresses.map((a: any, i: number) => (
                                    <TouchableOpacity key={i} onPress={() => {
                                        setSelectedAddressIndex(i);
                                        setAddressLine(a.addressLine || '');
                                        setCity(a.city || '');
                                        setProvince(a.province || '');
                                        setPostalCode(a.postalCode || '');
                                        setCountry(a.country || '');
                                    }} style={{ padding: 10, borderRadius: 8, backgroundColor: selectedAddressIndex === i ? colors.primary : colors.card, marginBottom: 8 }}>
                                        <Text style={{ color: selectedAddressIndex === i ? '#fff' : colors.text }}>{a.label || `Ubicación ${i+1}`}</Text>
                                        <Text style={{ color: selectedAddressIndex === i ? '#fff' : colors.muted, fontSize: 12 }}>{a.addressLine}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                        <TextInput placeholder="Calle, número, apto" value={addressLine} onChangeText={setAddressLine} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.muted} />
                        <TextInput placeholder="Ciudad" value={city} onChangeText={setCity} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.muted} />
                        <TextInput placeholder="Provincia / Estado" value={province} onChangeText={setProvince} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.muted} />
                        <TextInput placeholder="Código postal" value={postalCode} onChangeText={setPostalCode} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.muted} />
                        <TextInput placeholder="País" value={country} onChangeText={setCountry} style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.muted} />
                        <TouchableOpacity onPress={() => setAddressCollapsed(true)} style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
                            <Text style={{ color: colors.primary }}>Colapsar</Text>
                        </TouchableOpacity>
                        </>
                    )}
                </View>
                {user?.uid ? (
                    <View style={{ marginTop: 12 }}>
                        <CustomButton title="Guardar dirección en mi perfil" onPress={async () => {
                            try {
                                const uid = (user as any).uid;
                                await updateUserProfile(uid, { address: { addressLine, city, province, postalCode, country } });
                                Alert.alert('Listo', 'Dirección guardada en tu perfil');
                            } catch (e: any) {
                                Alert.alert('Error', e?.message || 'No se pudo guardar');
                            }
                        }} variant="secondary" />
                    </View>
                ) : (
                    <View style={{ marginTop: 12 }}>
                        <CustomButton title="Guardar dirección local" onPress={async () => {
                            try {
                                await AsyncStorage.setItem('@localAddress', JSON.stringify({ addressLine, city, province, postalCode, country }));
                                Alert.alert('Listo', 'Dirección guardada localmente');
                            } catch {}
                        }} variant="secondary" />
                    </View>
                )}
                <TouchableOpacity style={{ marginTop: 24, alignSelf: 'flex-start' }} onPress={() => navigation.navigate('ServiceReservations', { serviceId: service.id || service.key || service })}>
                    <Text style={{ color: colors.primary }}>Ver reservas relacionadas {loadingReservations ? '...' : `(${reservations.length})`}</Text>
                </TouchableOpacity>
                </ScrollView>
                <View style={styles.fabArea}>
                    <CustomButton title={service.active ? "Reservar" : "Inactivo"} onPress={handleReserve} disabled={!service.active} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    modalContainer: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.4)' },
    sheet: { maxHeight: '92%', borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:20, paddingTop:8, paddingBottom:0 },
    sheetHandle: { width:50, height:5, borderRadius:3, backgroundColor:'#ccc', alignSelf:'center', marginBottom:12 },
    modalHeader: { flexDirection:'row', alignItems:'center', marginBottom:8 },
    closeBtn: { paddingHorizontal:12, paddingVertical:6, borderRadius:16, backgroundColor:'rgba(0,0,0,0.04)' },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
    tag: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, marginRight: 8, marginBottom: 8 },
    reservationRow: { paddingVertical: 8, borderBottomWidth: 1 },
    providerRow: { width: '100%' },
    ownerAvatar: { width: 56, height: 56, borderRadius: 28 },
    title: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 8,
    },
    image: {
        width: 140,
        height: 140,
        marginBottom: 12,
    },
    desc: {
        textAlign: 'center',
        color: '#4a4e69',
        marginTop: 10,
    },
    input: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    },
    fieldLabel: { marginTop: 8, fontWeight: '700' },
    sectionTitle: { fontWeight: '700', marginBottom: 8 },
    addressSummary: { padding:12, borderRadius:10, borderWidth:1, marginBottom:8 },
    fabArea: { position:'absolute', left:0, right:0, bottom:0, padding:16, borderTopWidth:StyleSheet.hairlineWidth, borderColor:'rgba(0,0,0,0.1)' }
});
 
