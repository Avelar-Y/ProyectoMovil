import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { listenMessages, sendMessage, listenReservation } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

export default function ChatRoom({ route, navigation }: any) {
  const { reservationId } = route.params || {};
  const { colors } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<any>(null);
  const [reservation, setReservation] = useState<any | null>(null);

  useEffect(() => {
    if (!reservationId) return;
    const unsub = listenMessages(reservationId, (msgs) => {
      setMessages(msgs || []);
      // scroll to bottom
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
    });
    return () => unsub && unsub();
  }, [reservationId]);

  useEffect(() => {
    if (!reservationId) return;
    const unsub = listenReservation(reservationId, (r) => setReservation(r));
    return () => unsub && unsub();
  }, [reservationId]);

  const getStatusLabel = (r: any) => {
    if (!r) return '';
    if (r.rejectedBy) return 'Rechazado';
    if (r.finishedAt) return 'Finalizado';
    if (r.startedAt) return 'En curso';
    if (r.assignedAt) return 'En camino';
    if (r.providerId) return 'Asignado';
    return 'Pendiente';
  };

  const handleSend = async () => {
    if (!text || !reservationId) return;
    setSending(true);
    try {
      await sendMessage(reservationId, { authorId: (user as any)?.uid, text });
      setText('');
    } catch (e) {
      console.warn('send message error', e);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: any) => {
    const isMe = item.authorId === (user as any)?.uid;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}>
        <View style={[styles.bubble, { backgroundColor: isMe ? colors.primary : colors.card }] }>
          <Text style={{ color: isMe ? '#fff' : colors.text }}>{item.text}</Text>
          <Text style={{ fontSize: 10, color: isMe ? '#fff' : colors.muted, marginTop: 6 }}>{new Date(item.createdAtClient || Date.now()).toLocaleTimeString()}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {/* Header with avatar and status */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Image source={{ uri: reservation?.providerAvatar || reservation?.userAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.headerAvatar} />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{reservation?.providerDisplayName || reservation?.name || 'Contacto'}</Text>
          <Text style={{ color: colors.muted }}>{getStatusLabel(reservation)}</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
        />
      </View>

      <View style={[styles.composer, { backgroundColor: colors.surface }] }>
        <TextInput placeholder="Escribe un mensaje..." value={text} onChangeText={setText} style={[styles.input, { color: colors.text }]} placeholderTextColor={colors.muted} />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: sending ? '#95a5a6' : colors.primary }]} onPress={handleSend} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Enviar</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  msgRow: { marginBottom: 8 },
  msgRowLeft: { alignItems: 'flex-start' },
  msgRowRight: { alignItems: 'flex-end' },
  bubble: { padding: 10, borderRadius: 12, maxWidth: '85%' },
  composer: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 8, marginRight: 8 },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }
  ,
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e0e0e0' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22 }
});
