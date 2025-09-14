import React from 'react';
import { View, Text, StyleSheet, Image, Switch, Alert } from 'react-native';
import { saveReservation } from '../services/firestoreService';
import CustomButton from '../components/CustomButton';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function Profile({ navigation }: any) {
    const { user, logout } = useAuth();
    const { colors, themeName, toggle } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }] }>
            <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                style={styles.avatar}
            />
            <Text style={[styles.email, { color: colors.text }]}>{user?.email || 'Usuario'}</Text>
            <View style={{ marginTop: 20, width: '80%' }}>
                <CustomButton title="Historial" onPress={() => navigation.navigate('History')} />

                <CustomButton title="Guardar prueba" onPress={async () => {
                    if (!user?.email) {
                        Alert.alert('Error', 'No hay usuario logueado');
                        return;
                    }
                    try {
                        const id = await saveReservation({
                            userEmail: user.email,
                            service: 'Prueba Servicio',
                            name: 'Reserva de prueba',
                            date: new Date().toISOString(),
                            note: 'Reservado desde app (test)'
                        });
                        Alert.alert('Guardado', `Reserva creada: ${id}`);
                    } catch (err: any) {
                        Alert.alert('Error', err?.message || String(err));
                    }
                }} variant="primary" />

                <View style={styles.themeRow}>
                    <Text style={{ color: colors.text }}>Tema oscuro</Text>
                    <Switch
                        trackColor={{ false: '#767577', true: colors.primary }}
                        thumbColor={themeName === 'dark' ? '#fff' : '#f4f3f4'}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => toggle()}
                        value={themeName === 'dark'}
                    />
                </View>

                <CustomButton title="Cerrar sesión" onPress={async () => { await logout(); }} variant="secondary" />
                <CustomButton title="Volver" onPress={() => navigation.goBack()} variant="tertiary" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f6fa',
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
});
