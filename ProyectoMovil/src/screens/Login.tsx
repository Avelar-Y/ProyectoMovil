import React, { useState, useRef } from "react";
import { Alert, StyleSheet, View, Animated, Text, Pressable } from "react-native";
import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import { useAuth } from "../contexts/AuthContext";
import { i18n } from "../contexts/LanguageContext";

export default function Login({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { login, register } = useAuth();

    const [mode, setMode] = useState<'chooser' | 'login' | 'register'>('chooser');

    const anim = useRef(new Animated.Value(0)).current; // chooser -> form
    const inputAnims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

    const resetInputAnims = () => inputAnims.forEach(a => a.setValue(0));

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
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert('Error', 'Por favor complete todos los campos');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }
        try {
            await register(email, password);
            navigation.navigate('HomeScreen', { correo: email });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const showForm = (target: 'login' | 'register') => {
        setMode(target);
        anim.setValue(0);
        resetInputAnims();
        Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }).start(() => {
            const anims = inputAnims.map(a => Animated.timing(a, { toValue: 1, duration: 300, useNativeDriver: true }));
            Animated.stagger(80, anims).start();
        });
    };

    const hideForm = () => {
        const reverseAnims = inputAnims.map(a => Animated.timing(a, { toValue: 0, duration: 130, useNativeDriver: true })).reverse();
        Animated.stagger(50, reverseAnims).start(() => {
            Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setMode('chooser'));
        });
    };

    const formTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const formOpacity = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 1] });
    const chooserOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    const chooserScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.chooserCard, { opacity: chooserOpacity, transform: [{ scale: chooserScale }] }]}> 
                <Text style={styles.title}>Bienvenido</Text>
                <Text style={styles.subtitle}>Accede a tu cuenta o crea una nueva</Text>
                <Pressable style={styles.bigButton} onPress={() => showForm('login')}>
                    <Text style={styles.bigButtonText}>Iniciar sesión</Text>
                </Pressable>
                <Pressable style={[styles.bigButton, styles.secondaryBigButton]} onPress={() => showForm('register')}>
                    <Text style={[styles.bigButtonText, styles.secondaryBigButtonText]}>Crear cuenta</Text>
                </Pressable>
            </Animated.View>

            <Animated.View style={[styles.formCard, { opacity: formOpacity, transform: [{ translateY: formTranslateY }] }]}> 
                <Text style={styles.formHeader}>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>
                <Pressable onPress={() => showForm(mode === 'login' ? 'register' : 'login')} style={{ marginBottom: 8 }}>
                    <Text style={styles.switchText}>{mode === 'login' ? '¿Quieres crear una cuenta?' : '¿Ya tienes cuenta? Inicia sesión'}</Text>
                </Pressable>

                {mode === 'register' && (
                    <Animated.View style={{ opacity: inputAnims[0], transform: [{ translateY: inputAnims[0].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                        <CustomInput type="text" value={name} title="Nombre" onChange={setName} required />
                    </Animated.View>
                )}

                <Animated.View style={{ opacity: inputAnims[1], transform: [{ translateY: inputAnims[1].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                    <CustomInput type="email" value={email} title="Correo" onChange={setEmail} required />
                </Animated.View>

                <Animated.View style={{ opacity: inputAnims[2], transform: [{ translateY: inputAnims[2].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                    <CustomInput type="password" value={password} title="Contraseña" onChange={setPassword} required />
                </Animated.View>

                {mode === 'register' && (
                    <Animated.View style={{ opacity: inputAnims[3], transform: [{ translateY: inputAnims[3].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                        <CustomInput type="password" value={confirmPassword} title="Confirmar contraseña" onChange={setConfirmPassword} required />
                    </Animated.View>
                )}

                <View style={{ marginTop: 12 }}>
                    {mode === 'login' ? (
                        <CustomButton title={i18n.t('signIn')} onPress={handleLogin} />
                    ) : (
                        <CustomButton title={i18n.t('signUp')} onPress={handleRegister} variant="secondary" />
                    )}

                    <CustomButton title="Volver" onPress={hideForm} variant="tertiary" />
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f6fa',
        padding: 20,
    },
    chooserCard: {
        width: '88%',
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 6,
        marginBottom: 14,
    },
    title: {
        fontSize: 26,
        color: '#fff',
        fontWeight: '700',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: '#cbd5e1',
        marginBottom: 18,
    },
    bigButton: {
        width: '80%',
        paddingVertical: 12,
        backgroundColor: '#2563eb',
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
    },
    bigButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    secondaryBigButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#94a3b8',
    },
    secondaryBigButtonText: {
        color: '#94a3b8',
    },
    formCard: {
        width: '88%',
        backgroundColor: '#071022cc',
        borderRadius: 16,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 10,
        elevation: 4,
    },
    formHeader: {
        fontSize: 20,
        color: '#fff',
        fontWeight: '700',
        marginBottom: 12,
    },
    switchText: {
        color: '#9fb4ff',
        textAlign: 'center',
        marginBottom: 6,
        fontSize: 13,
    },
});