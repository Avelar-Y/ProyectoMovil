import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { listenReservation, updateReservation, cancelReservationAtomic, acceptReservation, getUserProfile } from '../services/firestoreService';

interface Props { route: any; navigation: any; }

const STATUS_FLOW: string[] = ['pending','confirmed','in_progress','completed'];

export default function ActiveReservationDetail({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const initial = route.params?.reservation || null;
  const reservationId = initial?.id || route.params?.reservationId;
  const [reservation, setReservation] = useState<any | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [profileRole, setProfileRole] = useState<'user' | 'provider' | null>(null);
  const isProvider = profileRole === 'provider';
  // cancel reason UI state
  const [showCancelUI, setShowCancelUI] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // load role
  useEffect(() => {
    (async () => {
      try {
        const uid = (user as any)?.uid; if (!uid) return;
        const p = await getUserProfile(uid);
        setProfileRole(p?.role === 'provider' ? 'provider' : 'user');
      } catch {}
    })();
  }, [user]);

  // subscribe to reservation changes
  useEffect(() => {
    if (!reservationId) return;
    let unsub: any = null;
    setLoading(true);
    unsub = listenReservation(reservationId, (res) => {
      setReservation(res);
      setLoading(false);
    });
    return () => { try { unsub && unsub(); } catch(_){} };
  }, [reservationId]);

  const status = reservation?.status;
  const canEditClient = !isProvider && status && ['pending','confirmed'].includes(status);
  const canAccept = isProvider && status === 'pending';
  const canCancelClient = !isProvider && status && ['pending','confirmed'].includes(status);
  const canChat = status && ['confirmed','in_progress'].includes(status);

  const stateColor = (s?: string) => {
    switch(s){
      case 'pending': return colors.muted;
      case 'confirmed': return colors.accent;
      case 'in_progress': return colors.primary;
      case 'completed': return colors.accent;
      case 'cancelled': return colors.danger;
      default: return colors.muted;
    }
  };

  const handleSave = async () => {
    if (!reservationId) return;
    try {
      await updateReservation(reservationId, { note: editNote || undefined, 'address.addressLine': editAddress || undefined });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar');
    }
  };

  const handleCancel = async () => {
    if (!reservationId) return;
    // Mostrar panel interno para capturar motivo (opcional).
    setShowCancelUI(true);
  };

  const handleAccept = async () => {
    if (!reservationId) return;
    try { await acceptReservation(reservationId); } catch(e:any){ Alert.alert('Error', e?.message || 'No se pudo aceptar'); }
  };

  const headerStatusLabel = (s?: string) => {
    if (!s) return '...';
    const map: any = { pending: 'Pendiente', confirmed: 'Confirmada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' };
    return map[s] || s;
  };

  const timeline = STATUS_FLOW.filter(step => step !== 'completed' || status === 'completed');

  return (
    <View style={[styles.modalContainer, { backgroundColor: colors.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <View style={[styles.statusChip, { backgroundColor: stateColor(status) }]}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{headerStatusLabel(status)}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Cerrar</Text>
          </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> : !reservation ? (
          <Text style={{ color: colors.muted, marginTop: 30 }}>Reserva no encontrada</Text>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{reservation.serviceSnapshot?.title || 'Servicio'}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>ID: {reservation.id}</Text>
            {typeof reservation.serviceSnapshot?.price !== 'undefined' && (
              <Text style={{ color: colors.text, fontWeight: '700', marginTop: 4 }}>${reservation.serviceSnapshot.price}</Text>
            )}

            <View style={[styles.section, { borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Participantes</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>Cliente: {reservation.name || reservation.userEmail}</Text>
              {reservation.providerDisplayName && (
                <Text style={{ color: colors.muted, marginTop: 2 }}>Proveedor: {reservation.providerDisplayName}</Text>
              )}
            </View>

            <View style={[styles.section, { borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Ubicación y nota</Text>
              <Text style={{ color: colors.text, marginTop: 6 }}>{reservation.address?.addressLine || 'Sin dirección'}</Text>
              {reservation.note ? (
                <Text style={{ color: colors.muted, marginTop: 4 }}>{reservation.note}</Text>
              ) : null}
              {editing && (
                <View style={{ marginTop: 10 }}>
                  <TextInput placeholder="Nueva dirección" value={editAddress} onChangeText={setEditAddress} placeholderTextColor={colors.muted} style={[styles.input,{ backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]} />
                  <TextInput placeholder="Nota" value={editNote} onChangeText={setEditNote} placeholderTextColor={colors.muted} style={[styles.input,{ backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, height:80 }]} multiline />
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <TouchableOpacity onPress={() => setEditing(false)} style={[styles.smallBtn,{ backgroundColor: colors.muted }]}><Text style={styles.smallBtnText}>Cancelar</Text></TouchableOpacity>
                    <TouchableOpacity onPress={handleSave} style={[styles.smallBtn,{ backgroundColor: colors.primary }]}><Text style={styles.smallBtnText}>Guardar</Text></TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <View style={[styles.section, { borderColor: colors.border }]}> 
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Progreso</Text>
              <View style={styles.timelineRow}>
                {timeline.map((step, i) => {
                  const reached = STATUS_FLOW.indexOf(step) <= STATUS_FLOW.indexOf(status || 'pending');
                  return (
                    <View key={step} style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: reached ? colors.primary : colors.border }]} />
                      {i < timeline.length -1 && <View style={[styles.timelineBar, { backgroundColor: reached ? colors.primary : colors.border }]} />}
                      <Text style={{ color: reached ? colors.primary : colors.muted, fontSize:10, marginTop:4 }}>{step}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {canEditClient && !editing && (
              <TouchableOpacity onPress={() => { setEditing(true); setEditNote(reservation.note || ''); setEditAddress(reservation.address?.addressLine || ''); }} style={[styles.inlineAction, { backgroundColor: colors.highlight }]}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Editar nota / dirección</Text>
              </TouchableOpacity>
            )}
            {canChat && (
              <TouchableOpacity onPress={() => navigation.navigate('Chat', { reservationId })} style={[styles.inlineAction, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Abrir chat</Text>
              </TouchableOpacity>
            )}
            {canAccept && (
              <TouchableOpacity onPress={handleAccept} style={[styles.inlineAction, { backgroundColor: colors.accent }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Aceptar reserva</Text>
              </TouchableOpacity>
            )}
            {canCancelClient && (
              <TouchableOpacity onPress={handleCancel} style={[styles.inlineAction, { backgroundColor: colors.danger }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancelar reserva</Text>
              </TouchableOpacity>
            )}
            {showCancelUI && (
              <View style={[styles.section, { borderColor: colors.border, marginTop: 18 }]}> 
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Motivo de cancelación</Text>
                <Text style={{ color: colors.muted, fontSize:12, marginTop:6 }}>Opcional, pero ayuda a mejorar el servicio.</Text>
                <TextInput
                  placeholder="Motivo (opcional)"
                  value={cancelReason}
                  onChangeText={setCancelReason}
                  multiline
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, height:90, textAlignVertical:'top' }]}
                />
                <View style={{ flexDirection:'row', gap:10, marginTop:4 }}>
                  <TouchableOpacity onPress={() => { setShowCancelUI(false); setCancelReason(''); }} style={[styles.smallBtn, { backgroundColor: colors.muted }]}> 
                    <Text style={styles.smallBtnText}>Volver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await cancelReservationAtomic(reservationId, cancelReason.trim() || undefined);
                        navigation.goBack();
                      } catch (e: any) {
                        Alert.alert('Error', e?.message || 'No se pudo cancelar');
                      }
                    }}
                    style={[styles.smallBtn, { backgroundColor: colors.danger }]}
                  >
                    <Text style={styles.smallBtnText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex:1, justifyContent:'flex-end' },
  sheet: { maxHeight:'92%', borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:20, paddingTop:8, borderWidth:1 },
  handle: { width:50, height:5, borderRadius:3, backgroundColor:'#666', alignSelf:'center', marginBottom:12 },
  headerRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  closeBtn: { paddingHorizontal:12, paddingVertical:6, borderRadius:16, backgroundColor:'rgba(0,0,0,0.05)' },
  statusChip: { paddingHorizontal:10, paddingVertical:6, borderRadius:14 },
  title: { fontSize:20, fontWeight:'700', marginBottom:4 },
  section: { marginTop:18, padding:14, borderRadius:14, borderWidth:1 },
  sectionTitle: { fontSize:14, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },
  input: { borderWidth:1, borderRadius:10, padding:10, marginBottom:8 },
  inlineAction: { marginTop:14, padding:14, borderRadius:14, alignItems:'center' },
  smallBtn: { flex:1, padding:12, borderRadius:10, alignItems:'center', marginTop:4 },
  smallBtnText: { color:'#fff', fontWeight:'600' },
  timelineRow: { flexDirection:'row', marginTop:12, justifyContent:'space-between' },
  timelineItem: { flex:1, alignItems:'center', position:'relative' },
  timelineDot: { width:16, height:16, borderRadius:8 },
  timelineBar: { position:'absolute', top:8, left:'50%', width:'100%', height:2, zIndex:-1 }
});
