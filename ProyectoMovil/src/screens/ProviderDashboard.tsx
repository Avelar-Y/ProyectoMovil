import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getServicesForProvider, saveService, getReservationsByProvider, updateReservationStatus, finishService, cancelReservation, setServiceActive, updateReservation } from '../services/firestoreService';

interface ProviderService { id?: string; title: string; price?: number; description?: string; }
interface ProviderReservation { id?: string; status?: string; serviceSnapshot?: any; service?: string; userEmail?: string; note?: string; }

export default function ProviderDashboard() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [services, setServices] = useState<ProviderService[]>([]);
  const [reservations, setReservations] = useState<ProviderReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', price:'', tags:'' });
  const [savingService, setSavingService] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const uid = (user as any).uid;
      const [svc, res] = await Promise.all([
        getServicesForProvider(uid),
        getReservationsByProvider(uid)
      ]);
      setServices(svc);
      // filtrar las relevantes (pending, confirmed, in_progress) primero
      const rel = res.filter(r => ['pending','confirmed','in_progress'].includes(r.status || ''));
      setReservations(rel);
    } catch (e) {
      console.warn('ProviderDashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onCreateService = async () => {
    if (!form.title.trim()) { Alert.alert('Falta título','Ingresa un título.'); return; }
    try {
      setSavingService(true);
      const uid = (user as any).uid;
      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        price: form.price ? Number(form.price) : null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean).slice(0,6) : [],
        ownerId: uid,
        active: true,
      };
      await saveService(payload);
      setForm({ title:'', description:'', price:'', tags:'' });
      setModalVisible(false);
      load();
    } catch (e:any) {
      Alert.alert('Error', e?.message || 'No se pudo crear');
    } finally { setSavingService(false); }
  };

  // Acciones sobre la reserva desde el panel proveedor. IMPORTANTE:
  // Necesitamos guardar providerId cuando el proveedor "Acepta" para que la pantalla ActiveReservationDetail
  // pueda iniciar el tracking (condición: reservation.providerId === user.uid).
  const updateReservationAction = async (id: string, action: 'accept'|'start'|'finish'|'cancel') => {
    try {
      if (action==='accept') {
        await updateReservationStatus(id,'confirmed');
        try {
          // Asignar providerId y metadatos básicos si aún no existen.
          const uid = (user as any).uid;
          await updateReservation(id, {
            providerId: uid,
            providerDisplayName: (user as any)?.displayName || (user as any)?.email || 'Proveedor',
          });
        } catch(e){ console.warn('Asignación providerId falló', e); }
      }
      else if (action==='start') await updateReservationStatus(id,'in_progress');
      else if (action==='finish') await finishService(id, (user as any).uid);
      else if (action==='cancel') await cancelReservation(id,'Proveedor canceló');
      load();
    } catch (e:any){
      Alert.alert('Acción fallida', e?.message || 'Error');
    }
  };

  const renderService = ({ item }: { item: ProviderService & { active?: boolean } }) => {
    const active = (item as any).active !== false; // default true
    return (
      <View style={[styles.card, { backgroundColor: colors.card, opacity: active ? 1 : 0.55 }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        {item.price!=null && <Text style={{ color: colors.primary, fontSize:12, marginTop:4 }}>${item.price}</Text>}
        <TouchableOpacity onPress={async () => {
          try {
            if (!item.id) return;
            await setServiceActive(item.id, !active);
            load();
          } catch (e:any) { Alert.alert('Error', e?.message || 'No se pudo actualizar'); }
        }} style={{ marginTop:8, alignSelf:'flex-start', paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor: active ? colors.danger : colors.primary }}>
          <Text style={{ color:'#fff', fontSize:11, fontWeight:'600' }}>{active ? 'Desactivar' : 'Activar'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderReservation = ({ item }: { item: ProviderReservation }) => {
    const status = item.status || 'pending';
    const title = item.serviceSnapshot?.title || item.service;
    const actions: { label:string; act: any; show:boolean }[] = [
      { label:'Aceptar', act:() => updateReservationAction(item.id!, 'accept'), show: status==='pending' },
      { label:'Iniciar', act:() => updateReservationAction(item.id!, 'start'), show: status==='confirmed' },
      { label:'Finalizar', act:() => updateReservationAction(item.id!, 'finish'), show: status==='in_progress' },
      { label:'Cancelar', act:() => updateReservationAction(item.id!, 'cancel'), show: ['pending','confirmed'].includes(status) }
    ];
    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize:12 }}>{item.userEmail}</Text>
        {!!item.note && <Text style={{ color: colors.muted, fontSize:11, marginTop:2 }} numberOfLines={2}>{item.note}</Text>}
        <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:6, gap:6 }}>
          {actions.filter(a=>a.show).map(a => (
            <TouchableOpacity key={a.label} onPress={a.act} style={[styles.actionBtn, { backgroundColor: a.label==='Cancelar'? colors.danger : colors.primary }]}> 
              <Text style={{ color:'#fff', fontSize:11, fontWeight:'600' }}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={{ color: colors.muted, fontSize:10, marginTop:6 }}>Estado: {status}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Panel Proveedor</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={[styles.createBtn, { backgroundColor: colors.primary }]}> 
          <Text style={{ color:'#fff', fontWeight:'600', fontSize:13 }}>Crear servicio</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}> 
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom:60 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mis servicios</Text>
          {services.length===0 && <Text style={{ color: colors.muted, fontSize:12, marginBottom:8 }}>Aún no has creado servicios.</Text>}
          <FlatList data={services} keyExtractor={s=>s.id!} renderItem={renderService} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:16 }} />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Reservas activas</Text>
          {reservations.some(r=>['confirmed','in_progress'].includes(r.status||'')) && (
            <TouchableOpacity onPress={() => {
              const active = reservations.find(r=>['confirmed','in_progress'].includes(r.status||''));
              if (active?.id) navigation.navigate('ProviderLiveRoute', { reservationId: active.id });
            }} style={{ alignSelf:'flex-start', backgroundColor: colors.primary, paddingHorizontal:14, paddingVertical:8, borderRadius:10, marginBottom:8 }}>
              <Text style={{ color:'#fff', fontSize:12, fontWeight:'600' }}>Ver ruta en vivo</Text>
            </TouchableOpacity>
          )}
          {reservations.length===0 && <Text style={{ color: colors.muted, fontSize:12 }}>No hay reservas pendientes o en progreso.</Text>}
          {reservations.map(r => <View key={r.id}>{renderReservation({ item: r })}</View>)}
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}> 
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nuevo Servicio</Text>
            <TextInput placeholder='Título' placeholderTextColor={colors.muted} value={form.title} onChangeText={t=>setForm(f=>({...f,title:t}))} style={[styles.input,{ borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg||colors.card }]} />
            <TextInput placeholder='Descripción' placeholderTextColor={colors.muted} value={form.description} onChangeText={t=>setForm(f=>({...f,description:t}))} style={[styles.input,{ borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg||colors.card }]} multiline />
            <TextInput placeholder='Precio' placeholderTextColor={colors.muted} keyboardType='numeric' value={form.price} onChangeText={t=>setForm(f=>({...f,price:t}))} style={[styles.input,{ borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg||colors.card }]} />
            <TextInput placeholder='Tags (coma separadas)' placeholderTextColor={colors.muted} value={form.tags} onChangeText={t=>setForm(f=>({...f,tags:t}))} style={[styles.input,{ borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg||colors.card }]} />
            <View style={{ flexDirection:'row', gap:12, marginTop:4 }}>
              <TouchableOpacity disabled={savingService} onPress={()=>setModalVisible(false)} style={[styles.btn,{ backgroundColor: colors.highlight }]}> 
                <Text style={[styles.btnTxt,{ color: colors.text }]}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={savingService} onPress={onCreateService} style={[styles.btn,{ backgroundColor: colors.primary, opacity: savingService?0.6:1 }]}> 
                <Text style={[styles.btnTxt,{ color:'#fff' }]}>{savingService? 'Guardando...' : 'Crear'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, paddingHorizontal:20, paddingTop:20 },
  headerRow:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  title:{ fontSize:20, fontWeight:'700' },
  createBtn:{ paddingHorizontal:14, paddingVertical:10, borderRadius:10 },
  sectionTitle:{ fontSize:16, fontWeight:'600', marginTop:10, marginBottom:6 },
  card:{ padding:12, borderRadius:12, marginRight:12, marginBottom:12 },
  cardTitle:{ fontSize:14, fontWeight:'600' },
  actionBtn:{ paddingHorizontal:10, paddingVertical:6, borderRadius:8 },
  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end' },
  modalCard:{ padding:18, borderTopLeftRadius:20, borderTopRightRadius:20 },
  modalTitle:{ fontSize:16, fontWeight:'700', marginBottom:8 },
  input:{ borderWidth:1, borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, marginBottom:10 },
  btn:{ flex:1, paddingVertical:12, borderRadius:10, alignItems:'center' },
  btnTxt:{ fontSize:14, fontWeight:'600' }
});
