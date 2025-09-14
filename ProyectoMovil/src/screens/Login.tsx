import React, { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import { useAuth } from "../contexts/AuthContext";
import { i18n } from "../contexts/LanguageContext";

export default function Login({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, register } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor complete todos los campos');
            return;
        }
        try {
            await login(email, password);
            navigation.navigate('HomeScreen', { correo: email });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleRegister = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor complete todos los campos');
            return;
        }
        try {
            await register(email, password);
            navigation.navigate('HomeScreen', { correo: email });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.backgroundCard}>
                <CustomInput type="email" value={email} title="Correo" onChange={setEmail} />
                <CustomInput type="password" value={password} title="Contraseña" onChange={setPassword} />
                <CustomButton title={i18n.t('signIn')} onPress={handleLogin} />
                <CustomButton title={i18n.t('signUp')} onPress={handleRegister} variant="secondary" />
                <CustomButton title={i18n.t('forgotPassword')} onPress={() => { }} variant="tertiary" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1E1E2C', // Fondo oscuro moderno
        padding: 20,
    },
    backgroundCard: {
        backgroundColor: '#FFFFFF', // Fondo blanco para contraste
        borderRadius: 15, // Bordes más redondeados
        padding: 30,
        width: '85%',
        shadowColor: '#000', // Sombra para dar profundidad
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
});