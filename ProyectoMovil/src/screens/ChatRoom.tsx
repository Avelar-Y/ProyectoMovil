import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { listenMessages, sendMessage, listenReservation, listenThreadMessages, sendThreadMessage, getOrCreateThread } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useRefresh } from '../contexts/RefreshContext';

// ChatRoom ahora soporta:
// - threadId (nuevo modelo unificado)
// - reservationId (legacy) -> se crea/obtiene thread y se redirige internamente

export default function ChatRoom({ route, navigation }: any) {
  const { reservationId, threadId: routeThreadId, lastReservationId } = route.params || {};
  const { colors } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<any>(null);
  const [reservation, setReservation] = useState<any | null>(null);
  const [threadId, setThreadId] = useState<string | null>(routeThreadId || null);
  const [mode, setMode] = useState<'thread' | 'legacy'>((routeThreadId ? 'thread' : 'legacy'));
  const [counterpart, setCounterpart] = useState<any>(null);

  // 1. Si llega solo reservationId (legacy), escuchamos esa reserva para extraer participantes y crear thread.
  useEffect(() => {
    if (threadId || !reservationId) return; // ya tenemos thread o no hay reserva
    const unsub = listenReservation(reservationId, async (r) => {
      setReservation(r);
      if (!r) return;
      // Determinar uids participantes
      const uid = (user as any)?.uid;
      const otherUid = r.providerId && r.providerId !== uid ? r.providerId : r.userId && r.userId !== uid ? r.userId : null;
      if (!uid || !otherUid) return;
      try {
        const createdId = await getOrCreateThread(uid, otherUid, {});
        setThreadId(createdId);
        setMode('thread');
      } catch (e) {
        console.warn('create thread from legacy reservation failed', e);
      }
    });
    return () => unsub && unsub();
  }, [reservationId, threadId]);

  // 2. Escuchar mensajes según modo
  useEffect(() => {
    if (mode === 'thread') {
      if (!threadId) return;
      const unsub = listenThreadMessages(threadId, (msgs) => {
        setMessages(msgs || []);
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
      });
      return () => unsub && unsub();
    } else {
      if (!reservationId) return;
      const unsub = listenMessages(reservationId, (msgs) => {
        setMessages(msgs || []);
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 100);
      });
      return () => unsub && unsub();
    }
  }, [mode, threadId, reservationId]);

  // 3. Escuchar reserva (para header) también si ya estamos en thread pero venía lastReservationId
  useEffect(() => {
    const rid = reservationId || lastReservationId;
    if (!rid) return;
    const unsub = listenReservation(rid, (r) => setReservation(r));
    return () => unsub && unsub();
  }, [reservationId, lastReservationId]);

  // 4. Refresh handler: recarga mensajes (solo legacy usa paginado actual; thread ya es realtime completo)
  const refreshCtx = useRefresh();
  const chatRoomRefreshHandler = React.useCallback(async () => {
    try {
      if (mode === 'legacy' && reservationId) {
        const page = await (await import('../services/firestoreService')).loadMessagesPage(reservationId, 50);
        setMessages(page.messages || []);
      }
      // En thread no hacemos nada (ya realtime)
    } catch (e) { console.warn('ChatRoom refresh failed', e); }
  }, [mode, reservationId]);

  React.useEffect(() => {
    const id = `ChatRoom-${threadId || reservationId || 'unknown'}`;
    refreshCtx.register(id, chatRoomRefreshHandler);
    return () => refreshCtx.unregister(id);
  }, [chatRoomRefreshHandler, threadId, reservationId]);

  const handleSend = async () => {
    if (!text) return;
    setSending(true);
    try {
      if (mode === 'thread' && threadId) {
        await sendThreadMessage(threadId, { authorId: (user as any)?.uid, text });
      } else if (reservationId) {
        await sendMessage(reservationId, { authorId: (user as any)?.uid, text });
      }
      setText('');
    } catch (e) {
      console.warn('send message error', e);
    } finally {
      setSending(false);
    }
  };

  const isReservationEvent = (m: any) => m.type === 'reservation_event';

  const renderItem = ({ item }: any) => {
    if (isReservationEvent(item)) {
      return (
        <View style={[styles.msgRowCenter]}>
          <View style={[styles.eventBubble, { backgroundColor: colors.card }] }>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{item.text || 'Evento de reserva'}</Text>
            {item.snapshot?.title ? <Text style={{ color: colors.text, fontWeight: '600', marginTop: 4 }}>{item.snapshot.title}</Text> : null}
            <Text style={{ fontSize: 10, color: colors.muted, marginTop: 4 }}>{new Date(item.createdAtClient || Date.now()).toLocaleString()}</Text>
          </View>
        </View>
      );
    }
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

  const headerTitle = () => {
    if (mode === 'legacy') return reservation?.providerDisplayName || reservation?.name || 'Contacto';
    // En threads, aún podemos usar info de la reserva si existe, si no placeholder
    return reservation?.providerDisplayName || reservation?.name || 'Chat';
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Image source={{ uri: reservation?.providerAvatar || reservation?.userAvatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }} style={styles.headerAvatar} />
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>{headerTitle()}</Text>
          {mode === 'legacy' && <Text style={{ color: colors.muted }}>{reservation?.status || ''}</Text>}
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
  msgRowCenter: { alignItems: 'center', marginBottom: 12 },
  bubble: { padding: 10, borderRadius: 12, maxWidth: '85%' },
  eventBubble: { padding: 10, borderRadius: 12, maxWidth: '85%', opacity: 0.9 },
  composer: { flexDirection: 'row', padding: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 8, marginRight: 8 },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 }
  ,
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e0e0e0' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22 }
});
