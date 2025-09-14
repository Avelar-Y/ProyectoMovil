import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import CustomButton from '../components/CustomButton';
import { useAuth } from '../contexts/AuthContext';

export default function Profile({ navigation }: any) {
    const { user, logout } = useAuth();

    return (
        <View style={styles.container}>
            <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }}
                style={styles.avatar}
            />
            <Text style={styles.email}>{user?.email || 'Usuario'}</Text>
            <View style={{ marginTop: 20 }}>
                <CustomButton title="Historial" onPress={() => navigation.navigate('History')} />
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
});
