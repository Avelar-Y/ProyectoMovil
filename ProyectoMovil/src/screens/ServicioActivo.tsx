import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, getActiveReservationForUser, getActiveReservationForProvider, listenReservation, /*listenMessages,*/ sendMessage, cancelReservation, acceptReservation, loadMessagesPage, listenNewMessages, updateReservation } from '../services/firestoreService';
import { getServicesForProvider } from '../services/firestoreService';
import { FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';

export default function ServicioActivo({ navigation }: any) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [profile, setProfile] = useState<any | null>(null);
    const [isProvider, setIsProvider] = useState(false);
        const [reservation, setReservation] = useState<any | null>(null);
        const [providerServices, setProviderServices] = useState<any[]>([]);
        const [showModal, setShowModal] = useState(false);
        const [editing, setEditing] = useState(false);
        const [editDate, setEditDate] = useState('');
        const [editNote, setEditNote] = useState('');
        const [editAddressLine, setEditAddressLine] = useState('');
        const [messages, setMessages] = useState<any[]>([]);
        const [composer, setComposer] = useState('');
        const [loadingMore, setLoadingMore] = useState(false);
        const [hasMore, setHasMore] = useState(true);
        const [lastDoc, setLastDoc] = useState<any | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const uid = (user as any)?.uid;
                if (uid) {
                    const p = await getUserProfile(uid);
                    if (mounted) {
                        setProfile(p || null);
                        setIsProvider(p?.role === 'provider');
                    }
                    // load active reservation (if any)
                    try {
                        let active = null;
                        if (p?.role === 'provider') {
                            active = await getActiveReservationForProvider(uid);
                            // load provider services
                            try {
                                const sv = await getServicesForProvider(uid);
                                if (mounted) setProviderServices(sv || []);
                            } catch (e) { console.warn('Could not load provider services', e); }
                        } else {
                            active = await getActiveReservationForUser(uid);
                        }
                        if (active && mounted) {
                            if (active.status === 'cancelled') {
                                // treat cancelled as no active reservation
                                setReservation(null);
                            } else {
                                setReservation(active);
                            }
                        }
                    } catch (e) {
                        console.warn('Could not load active reservation', e);
                    }
                }
            } catch (e) {
                console.warn('Could not load profile for ServicioActivo', e);
            }
        })();
        return () => { mounted = false };
    }, [user]);

    const handleAction = () => {
        if (!reservation) {
            Alert.alert('No hay reserva', 'No se encontró una reserva activa.');
            return;
        }
        if (isProvider) {
            Alert.alert('Aceptar servicio', '¿Confirmas que deseas aceptar el servicio?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Aceptar', onPress: async () => {
                    try { await acceptReservation(reservation.id); Alert.alert('Hecho', 'Reserva aceptada'); }
                    catch(e:any){ Alert.alert('Error', e?.message || 'No se pudo aceptar'); }
                }}
            ]);
        } else {
            Alert.alert('Cancelar servicio', '¿Seguro que quieres cancelar la reserva?', [
                { text: 'No', style: 'cancel' },
                { text: 'Sí, cancelar', onPress: async () => {
                    try { await cancelReservation(reservation.id); Alert.alert('Hecho', 'Reserva cancelada'); }
                    catch(e:any){ Alert.alert('Error', e?.message || 'No se pudo cancelar'); }
                }}
            ]);
        }
    }

    // listeners for reservation and messages. Use paginated load + listenNewMessages to append new ones
    useEffect(() => {
        let unsubRes: any = null;
        let unsubNewMsgs: any = null;
        let mounted = true;
        if (!reservation) return;
        // subscribe to reservation changes
        unsubRes = listenReservation(reservation.id, (data) => {
            if (!data || data.status === 'cancelled') {
                setReservation(null);
            } else setReservation(data);
        });

        // initial load of recent messages
        (async () => {
            try {
                const page = await loadMessagesPage(reservation.id, 25);
                if (!mounted) return;
                setMessages(page.messages || []);
                setLastDoc(page.lastVisible || null);
                setHasMore((page.messages || []).length === 25);

                // listen for new messages after the latest createdAtClient
                const lastTs = page.messages && page.messages.length > 0 ? (page.messages[page.messages.length - 1].createdAtClient || Date.now()) : Date.now();
                unsubNewMsgs = listenNewMessages(reservation.id, lastTs, (newMsgs) => {
                    if (!mounted) return;
                    if (newMsgs && newMsgs.length > 0) setMessages(prev => [...prev, ...newMsgs]);
                });
            } catch (e) {
                console.warn('initial messages load failed', e);
            }
        })();

        return () => { mounted = false; try { unsubRes && unsubRes(); } catch(_){}; try { unsubNewMsgs && unsubNewMsgs(); } catch(_){} };
    }, [reservation?.id]);

    const handleSend = async () => {
        if (!reservation) return Alert.alert('Error', 'No hay reserva activa');
        if (!composer || composer.trim().length === 0) return;
        try {
            await sendMessage(reservation.id, { authorId: (user as any)?.uid, text: composer.trim() });
            setComposer('');
        } catch (e:any) {
            Alert.alert('Error', e?.message || 'No se pudo enviar el mensaje');
        }
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }] }>
            <Text style={[styles.title, { color: colors.text }]}>Servicio activo</Text>
            <Text style={{ color: colors.muted, marginTop: 8 }}>Aquí verás el chat y el estado de tu servicio activo.</Text>

            <View style={{ marginTop: 20, flex: 1 }}>
                { isProvider ? (
                    <View>
                        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Mis servicios</Text>
                        { providerServices.length === 0 ? (
                            <Text style={{ color: colors.muted }}>No tienes servicios publicados.</Text>
                        ) : (
                            providerServices.map(s => (
                                <View key={s.id} style={{ padding: 10, backgroundColor: colors.card, borderRadius: 8, marginBottom: 8 }}>
                                    <Text style={{ fontWeight: '700' }}>{s.title}</Text>
                                    <Text style={{ color: colors.muted }}>{s.price ? `${s.price}` : 'Sin precio'}</Text>
                                </View>
                            ))
                        )}
                        <View style={{ marginTop: 12 }}>
                            <Text style={{ fontWeight: '700', marginBottom: 6 }}>Reserva activa</Text>
                            {reservation ? (
                                <TouchableOpacity onPress={() => setShowModal(true)}>
                                    <View>
                                        <Text style={{ fontWeight: '700', marginBottom: 6 }}>{reservation.serviceSnapshot?.title || 'Servicio'}</Text>
                                        <Text style={{ color: colors.muted }}>{reservation.address?.addressLine || 'Sin dirección'}</Text>
                                        <Text style={{ marginTop: 4, color: colors.primary, fontWeight: '700' }}>{String(reservation.status || 'pending')}</Text>
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <Text style={{ color: colors.muted }}>No hay reservas activas como proveedor.</Text>
                            )}
                        </View>
                    </View>
                ) : (
                    // cliente
                    <>
                        {/* Reservation summary */}
                        {reservation ? (
                            <TouchableOpacity onPress={() => setShowModal(true)}>
                                <View>
                                    <Text style={{ fontWeight: '700', marginBottom: 6 }}>{reservation.serviceSnapshot?.title || 'Servicio'}</Text>
                                    <Text style={{ color: colors.muted }}>{reservation.address?.addressLine || 'Sin dirección'}</Text>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <Text style={{ color: colors.muted }}>No tienes una reserva activa.</Text>
                        )}
                    </>
                )}

                {/* Messages list */}
                <View style={{ marginTop: 12, flex: 1 }}>
                        <FlatList
                            data={messages}
                            keyExtractor={(i) => i.id}
                            ListHeaderComponent={hasMore ? (
                                <TouchableOpacity onPress={async () => {
                                    if (!reservation) return;
                                    setLoadingMore(true);
                                    try {
                                        const res = await loadMessagesPage(reservation.id, 25, lastDoc || undefined);
                                        if (res.messages.length === 0) setHasMore(false);
                                        else {
                                            setMessages(prev => [...res.messages, ...prev]);
                                            setLastDoc(res.lastVisible || null);
                                        }
                                    } catch (e) { console.warn('load more messages failed', e); }
                                    setLoadingMore(false);
                                }} style={{ padding: 8, alignItems: 'center' }}>
                                    {loadingMore ? <ActivityIndicator /> : <Text style={{ color: colors.primary }}>Cargar mensajes anteriores</Text>}
                                </TouchableOpacity>
                            ) : null}
                            renderItem={({ item }) => (
                                <View style={{ padding: 8, marginVertical: 6, backgroundColor: (item.authorId === (user as any)?.uid) ? colors.primary : colors.card, borderRadius: 10 }}>
                                    <Text style={{ color: (item.authorId === (user as any)?.uid) ? '#fff' : colors.text }}>{item.text}</Text>
                                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>{item.createdAt ? String(item.createdAt) : ''}</Text>
                                </View>
                            )}
                        />
                </View>

                {/* Composer */}
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TextInput value={composer} onChangeText={setComposer} placeholder="Escribe un mensaje" style={{ flex: 1, backgroundColor: colors.inputBg, borderRadius: 8, padding: 10, color: colors.text }} />
                        <TouchableOpacity onPress={handleSend} style={[styles.chatButton, { backgroundColor: colors.primary }]}>
                            <Text style={{ color: '#fff', fontWeight: '700' }}>Enviar</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>

                <TouchableOpacity onPress={handleAction} style={[styles.actionButton, { backgroundColor: isProvider ? colors.primary : '#e53935', marginTop: 12 }]}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{isProvider ? 'Aceptar' : 'Cancelar'}</Text>
                </TouchableOpacity>
            </View>

            {/* Modal with reservation details and Chat button when accepted */}
            <Modal visible={showModal} animationType="slide" transparent={true} onRequestClose={() => setShowModal(false)}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <View style={{ width: '90%', backgroundColor: colors.card, padding: 16, borderRadius: 12 }}>
                        <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>{reservation?.serviceSnapshot?.title || 'Detalle de reserva'}</Text>
                        <Text style={{ color: colors.muted }}>Estado: {reservation?.status || 'pendiente'}</Text>

                        { editing ? (
                            <View>
                                <Text style={{ marginTop: 8 }}>Fecha</Text>
                                <TextInput value={editDate} onChangeText={setEditDate} style={{ borderWidth: 1, borderColor: colors.border, padding: 8, borderRadius: 8, marginTop: 6 }} />
                                <Text style={{ marginTop: 8 }}>Nota</Text>
                                <TextInput value={editNote} onChangeText={setEditNote} style={{ borderWidth: 1, borderColor: colors.border, padding: 8, borderRadius: 8, marginTop: 6 }} />
                                <Text style={{ marginTop: 8 }}>Dirección</Text>
                                <TextInput value={editAddressLine} onChangeText={setEditAddressLine} style={{ borderWidth: 1, borderColor: colors.border, padding: 8, borderRadius: 8, marginTop: 6 }} />
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                                    <TouchableOpacity onPress={() => setEditing(false)} style={{ padding: 10, borderRadius: 8, backgroundColor: colors.muted }}>
                                        <Text style={{ color: '#fff' }}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={async () => {
                                        if (!reservation) return;
                                        try {
                                            await updateReservation(reservation.id, { date: editDate || undefined, note: editNote || undefined, 'address.addressLine': editAddressLine || undefined });
                                            // refresh local reservation (use provider/user specific loader)
                                            const uid = (user as any)?.uid;
                                            let updated = null;
                                            const p = await getUserProfile(uid);
                                            if (p?.role === 'provider') updated = await getActiveReservationForProvider(uid);
                                            else updated = await getActiveReservationForUser(uid);
                                            setReservation(updated);
                                            setEditing(false);
                                            setShowModal(false);
                                        } catch (e:any) { Alert.alert('Error', e?.message || 'No se pudo actualizar'); }
                                    }} style={{ padding: 10, borderRadius: 8, backgroundColor: colors.primary }}>
                                        <Text style={{ color: '#fff' }}>Guardar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                <Text style={{ marginTop: 8 }}>{reservation?.date}</Text>
                                <Text style={{ marginTop: 8 }}>{reservation?.address?.addressLine}</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                                    <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 10, borderRadius: 8, backgroundColor: colors.muted }}>
                                        <Text style={{ color: '#fff' }}>Cerrar</Text>
                                    </TouchableOpacity>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        { !isProvider ? (
                                            <>
                                                <TouchableOpacity onPress={() => {
                                                    // open edit mode prefilled
                                                    setEditDate(reservation?.date || '');
                                                    setEditNote(reservation?.note || '');
                                                    setEditAddressLine(reservation?.address?.addressLine || '');
                                                    setEditing(true);
                                                }} style={{ padding: 10, borderRadius: 8, backgroundColor: '#888', marginRight: 8 }}>
                                                    <Text style={{ color: '#fff' }}>Editar</Text>
                                                </TouchableOpacity>
                                                { (reservation?.status === 'in_progress' || reservation?.status === 'confirmed') ? (
                                                    <TouchableOpacity onPress={() => { setShowModal(false); navigation.navigate('Chat', { reservationId: reservation.id }); }} style={{ padding: 10, borderRadius: 8, backgroundColor: colors.primary }}>
                                                        <Text style={{ color: '#fff' }}>Chat</Text>
                                                    </TouchableOpacity>
                                                ) : null }
                                            </>
                                            ) : (
                                            // Provider actions: Accept / Reject only when pending
                                            <>
                                                { reservation?.status === 'pending' ? (
                                                    <>
                                                        <TouchableOpacity onPress={async () => {
                                                            try {
                                                                await acceptReservation(reservation.id);
                                                                // refresh
                                                                const updated = await getActiveReservationForProvider((user as any).uid);
                                                                setReservation(updated);
                                                                Alert.alert('Hecho', 'Reserva aceptada');
                                                                setShowModal(false);
                                                            } catch(e:any){ Alert.alert('Error', e?.message || 'No se pudo aceptar'); }
                                                        }} style={{ padding: 10, borderRadius: 8, backgroundColor: colors.primary, marginRight: 8 }}>
                                                            <Text style={{ color: '#fff' }}>Aceptar</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={async () => {
                                                            try {
                                                                await cancelReservation(reservation.id, 'rejected');
                                                                const updated = await getActiveReservationForProvider((user as any).uid);
                                                                setReservation(updated);
                                                                Alert.alert('Hecho', 'Reserva rechazada');
                                                                setShowModal(false);
                                                            } catch(e:any){ Alert.alert('Error', e?.message || 'No se pudo rechazar'); }
                                                        }} style={{ padding: 10, borderRadius: 8, backgroundColor: '#e53935' }}>
                                                            <Text style={{ color: '#fff' }}>Rechazar</Text>
                                                        </TouchableOpacity>
                                                    </>
                                                ) : (
                                                    // already accepted or in progress -> show status and chat
                                                    reservation?.status ? (
                                                        (reservation?.status === 'in_progress' || reservation?.status === 'confirmed') ? (
                                                            <TouchableOpacity onPress={() => { setShowModal(false); navigation.navigate('Chat', { reservationId: reservation.id }); }} style={{ padding: 10, borderRadius: 8, backgroundColor: colors.primary }}>
                                                                <Text style={{ color: '#fff' }}>Chat</Text>
                                                            </TouchableOpacity>
                                                        ) : (
                                                            <Text style={{ color: colors.muted }}>Estado: {reservation?.status}</Text>
                                                        )
                                                    ) : null
                                                )}
                                            </>
                                        )}
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    title: { fontSize: 22, fontWeight: '700' },
    chatButton: { padding: 14, borderRadius: 12, alignItems: 'center' },
    actionButton: { padding: 14, borderRadius: 12, alignItems: 'center' },
});
