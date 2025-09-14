import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TextInput, Alert, Modal } from 'react-native';
import CustomButton from '../components/CustomButton';
import { useAuth } from '../contexts/AuthContext';
import { saveReservation } from '../services/firestoreService';

export default function ServiceDetail({ route, navigation }: any) {
    const { service } = route.params || { service: 'unknown' };
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [note, setNote] = useState('');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const { user } = useAuth();

    const handleReserve = async () => {
        if (!name || !date) {
            Alert.alert('Error', 'Por favor completa nombre y fecha');
            return;
        }
        try {
            await saveReservation({ userEmail: user?.email ?? 'unknown', service, name, date, note });
            Alert.alert('Reservado', `Has reservado ${service} para ${date}`);
            navigation.goBack();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'No se pudo guardar la reserva');
        }
    }

    const titleMap: any = {
        plumber: 'Fontanero',
        painter: 'Pintor',
        electrician: 'Electricista',
        musician: 'Músico',
        field: 'Trabajos de campo'
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{titleMap[service] || 'Servicio'}</Text>
            <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/854/854878.png' }} style={styles.image} />
            <Text style={styles.desc}>Descripción breve del servicio seleccionado. Aquí puedes agregar detalles, costos estimados y tiempo aproximado.</Text>

            <TextInput placeholder="Tu nombre" value={name} onChangeText={setName} style={styles.input} />
            <TextInput placeholder="Fecha (ej. 2025-09-20)" value={date} onChangeText={setDate} style={styles.input} />
            <TextInput placeholder="Nota adicional" value={note} onChangeText={setNote} style={[styles.input, { height: 80 }]} multiline />

            <CustomButton title="Reservar" onPress={handleReserve} />
            <CustomButton title="Volver" onPress={() => navigation.goBack()} variant="tertiary" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
        backgroundColor: '#f5f6fa'
    },
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
        marginBottom: 12,
    },
    input: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
    }
});
