import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { computePaymentBreakdown, PaymentBreakdown } from '../services/payments/feeUtils';
import CustomButton from './CustomButton';

interface CardMeta { id: string; brand: string; last4: string; expMonth: number; expYear: number; holderName: string; }

interface Props {
  visible: boolean;
  onClose: () => void;
  price: number; // base price (service subtotal)
  cards: CardMeta[];
  defaultMethod?: 'card' | 'cash';
  onConfirm: (data: { method: 'card' | 'cash'; cardId?: string; breakdown: PaymentBreakdown }) => Promise<void> | void;
  loading?: boolean;
}

export default function PaymentModal({ visible, onClose, price, cards, defaultMethod='card', onConfirm, loading }: Props) {
  const { colors } = useTheme();
  const [method, setMethod] = useState<'card'|'cash'>(defaultMethod);
  const [cardId, setCardId] = useState<string | undefined>(cards[0]?.id);
  const breakdown = computePaymentBreakdown(price || 0, method);
  useEffect(()=>{ if (cards.length && !cardId) setCardId(cards[0].id); }, [cards.length]);

  const confirm = async () => {
    await onConfirm({ method, cardId: method === 'card' ? cardId : undefined, breakdown });
  };

  return (
    <Modal visible={visible} animationType='slide' transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Confirmar pago</Text>
          <View style={styles.segmentRow}>
            {['card','cash'].map(m => (
              <TouchableOpacity key={m} onPress={()=>setMethod(m as any)} style={[styles.segmentItem, { backgroundColor: method===m? colors.primary: 'transparent', borderColor: colors.border }]}> 
                <Text style={{ color: method===m? '#fff': colors.text, fontWeight:'600', fontSize:12 }}>{m==='card'?'Tarjeta':'Efectivo'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {method==='card' && (
            <View style={{ marginTop:12 }}>
              {cards.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize:12 }}>No tienes tarjetas guardadas.</Text>
              ) : (
                cards.map(c => (
                  <TouchableOpacity key={c.id} onPress={()=>setCardId(c.id)} style={[styles.cardRow, { borderColor: cardId===c.id? colors.primary: colors.border }]}> 
                    <Text style={{ color: colors.text, fontWeight:'600' }}>{c.brand.toUpperCase()} •••• {c.last4}</Text>
                    <Text style={{ color: colors.muted, fontSize:11 }}>Exp {String(c.expMonth).padStart(2,'0')}/{String(c.expYear).slice(-2)}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
          <View style={{ marginTop:16 }}>
            <Text style={{ color: colors.text, fontWeight:'700', marginBottom:6 }}>Desglose (HNL)</Text>
            <Line label='Subtotal servicio' value={breakdown.base} color={colors.text} />
            <Line label='Comisión reservación' value={breakdown.bookingFee} color={colors.muted} />
            {breakdown.processingPercent > 0 && (
              <Line label={`Procesamiento (${breakdown.processingPercent}% )`} value={breakdown.processingAmount} color={colors.muted} />
            )}
            <Line label='Total a pagar' value={breakdown.total} bold color={colors.text} />
            <Line label='Proveedor recibe' value={breakdown.providerReceives} color={colors.muted} small />
          </View>
          <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:18 }}>
            <CustomButton title='Cancelar' onPress={onClose} variant='tertiary' />
            <CustomButton title={loading? 'Procesando...' : 'Confirmar'} onPress={confirm} disabled={loading || (method==='card' && !cardId)} />
          </View>
          {loading && <ActivityIndicator style={{ marginTop:8 }} color={colors.primary} />}
        </View>
      </View>
    </Modal>
  );
}

function Line({ label, value, color, bold, small }:{ label:string; value:number; color:string; bold?:boolean; small?:boolean }){
  return (
    <View style={{ flexDirection:'row', justifyContent:'space-between', marginVertical:2 }}>
      <Text style={{ color, fontSize: small?10:12 }}>{label}</Text>
      <Text style={{ color, fontWeight: bold? '700':'500', fontSize: small?10:12 }}>L {value.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'flex-end' },
  sheet: { padding:16, borderTopLeftRadius:24, borderTopRightRadius:24, borderWidth:1 },
  title: { fontSize:18, fontWeight:'700' },
  segmentRow: { flexDirection:'row', marginTop:4 },
  segmentItem: { paddingVertical:8, paddingHorizontal:14, borderRadius:14, marginRight:8, borderWidth:1 },
  cardRow: { padding:10, borderWidth:1, borderRadius:10, marginVertical:4 }
});
