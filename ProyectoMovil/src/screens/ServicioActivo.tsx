import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, getActiveReservationForUser, listenReservation, /*listenMessages,*/ sendMessage, cancelReservation, acceptReservation, loadMessagesPage, listenNewMessages } from '../services/firestoreService';
import { FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';

export default function ServicioActivo({ navigation }: any) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [profile, setProfile] = useState<any | null>(null);
    const [isProvider, setIsProvider] = useState(false);
        const [reservation, setReservation] = useState<any | null>(null);
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
                        const active = await getActiveReservationForUser(uid);
                        if (active && mounted) setReservation(active);
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
        unsubRes = listenReservation(reservation.id, (data) => setReservation(data));

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
                {/* Reservation summary */}
                {reservation ? (
                    <View>
                        <Text style={{ fontWeight: '700', marginBottom: 6 }}>{reservation.serviceSnapshot?.title || 'Servicio'}</Text>
                        <Text style={{ color: colors.muted }}>{reservation.address?.addressLine || 'Sin dirección'}</Text>
                    </View>
                ) : (
                    <Text style={{ color: colors.muted }}>No tienes una reserva activa.</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    title: { fontSize: 22, fontWeight: '700' },
    chatButton: { padding: 14, borderRadius: 12, alignItems: 'center' },
    actionButton: { padding: 14, borderRadius: 12, alignItems: 'center' },
});
