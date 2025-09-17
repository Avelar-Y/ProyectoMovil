import React, { useState, useRef } from "react";
import { Alert, StyleSheet, View, Animated, Text, Pressable, ActivityIndicator, ScrollView, Dimensions, Switch, Modal, FlatList, TouchableOpacity } from "react-native";
import CustomButton from "../components/CustomButton";
import CustomInput from "../components/CustomInput";
import { useAuth } from "../contexts/AuthContext";
import { i18n } from "../contexts/LanguageContext";
import { useTheme } from "../contexts/ThemeContext";

export default function Login({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<'user' | 'provider'>('user');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [confirmPassword, setConfirmPassword] = useState('');
    const { login, register, loginWithSavedAccount, remember: rememberContext, setRemember, savedAccounts, removeSavedAccount, saveCredentials } = useAuth();
    const [remember, setRememberLocal] = useState<boolean>(rememberContext ?? true);
    const [submitting, setSubmitting] = useState(false);
    const [showErrors, setShowErrors] = useState(false);
    const [showAccountsModal, setShowAccountsModal] = useState(false);

    const [mode, setMode] = useState<'chooser' | 'login' | 'register'>('chooser');

    const anim = useRef(new Animated.Value(0)).current; // chooser -> form
    const inputAnims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

    const resetInputAnims = () => inputAnims.forEach(a => a.setValue(0));

    const handleLogin = async () => {
        setShowErrors(true);
        if (!email || !password) {
            Alert.alert('Error', 'Por favor complete todos los campos');
            return;
        }
        try {
            setSubmitting(true);
            await login(email, password, remember);
            try { await setRemember(remember); } catch (_) {}
            // Nota: no navegamos manualmente a 'Main' porque el AppNavigator cambia cuando AuthProvider
            // actualiza el estado `user`. Dejar que la reactividad de auth maneje la navegación evita
            // intentar navegar a una pantalla que no existe en el stack actual y elimina la advertencia.
        } catch (error: any) {
            console.log(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = async () => {
        setShowErrors(true);
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert('Error', 'Por favor complete todos los campos');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }
        try {
            setSubmitting(true);
            await register(email, password, name, phone, /* avatarUrl removed */ undefined, role, gender, remember);
            try { await setRemember(remember); } catch (_) {}
            // No navegamos manualmente por la misma razón que en login: el cambio de estado auth
            // causará que `AppNavigator` renderice las pantallas del usuario autenticado.
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSubmitting(false);
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
    // compute an offset relative to screen height so the form rises a sensible amount on all devices
    const screenHeight = Dimensions.get('window').height;
    const formUpOffset = mode !== 'chooser' ? -Math.round(screenHeight * 0.17) : 0;

    const { colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }] }>
            <Animated.View style={[styles.chooserCard, { opacity: chooserOpacity, transform: [{ scale: chooserScale }], backgroundColor: 'transparent' }]}> 
                <Text style={[styles.title, { color: colors.text }]}>Bienvenido</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>Accede a tu cuenta o crea una nueva</Text>
                <Pressable style={[styles.bigButton, { backgroundColor: colors.primary }]} onPress={() => showForm('login')}>
                    <Text style={styles.bigButtonText}>Iniciar sesión</Text>
                </Pressable>
                <Pressable style={[styles.bigButton, styles.secondaryBigButton, { borderColor: colors.border }]} onPress={() => showForm('register')}>
                    <Text style={[styles.bigButtonText, { color: colors.muted }]}>Crear cuenta</Text>
                </Pressable>
            </Animated.View>

            <Animated.View style={[styles.formCard, { opacity: formOpacity, transform: [{ translateY: formTranslateY }, { translateY: mode !== 'chooser' ? formUpOffset : 0 }], backgroundColor: colors.card }]}> 
                <ScrollView contentContainerStyle={{ paddingBottom: 18 }} keyboardShouldPersistTaps="handled">
                <Text style={[styles.formHeader, { color: colors.text }]}>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</Text>
                <Pressable onPress={() => showForm(mode === 'login' ? 'register' : 'login')} style={{ marginBottom: 8 }}>
                    <Text style={[styles.switchText, { color: colors.primary }]}>{mode === 'login' ? '¿Quieres crear una cuenta?' : '¿Ya tienes cuenta? Inicia sesión'}</Text>
                </Pressable>

                {mode === 'register' && (
                    <>
                        <Animated.View style={{ opacity: inputAnims[0], transform: [{ translateY: inputAnims[0].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                            <CustomInput type="text" value={name} title="Nombre" onChange={setName} required forceShowError={showErrors} />
                        </Animated.View>
                        <Animated.View style={{ opacity: inputAnims[1], transform: [{ translateY: inputAnims[1].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                            <CustomInput type="text" value={phone} title="Teléfono (opcional)" onChange={setPhone} />
                        </Animated.View>
                        <Animated.View style={{ opacity: inputAnims[2], transform: [{ translateY: inputAnims[2].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                            <CustomInput type="email" value={email} title="Correo" onChange={setEmail} required forceShowError={showErrors} />
                        </Animated.View>
                        <Animated.View style={{ opacity: inputAnims[3], transform: [{ translateY: inputAnims[3].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                            <CustomInput type="password" value={password} title="Contraseña" onChange={setPassword} required forceShowError={showErrors} />
                        </Animated.View>
                        <Animated.View style={{ opacity: inputAnims[4], transform: [{ translateY: inputAnims[4].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                            <CustomInput type="password" value={confirmPassword} title="Confirmar contraseña" onChange={setConfirmPassword} required forceShowError={showErrors} />
                        </Animated.View>
                    </>
                )}
                {/* Avatar URL removed as requested */}
                {mode === 'register' && (
                    <Animated.View style={{ marginTop: 8 }}>
                        <Text style={{ marginBottom: 6, color: colors.muted }}>Tipo de cuenta</Text>
                        <View style={{ flexDirection: 'row' }}>
                            <Pressable onPress={() => setRole('user')} style={{ marginRight: 12 }}><Text style={{ color: role === 'user' ? colors.primary : colors.muted }}>Usuario</Text></Pressable>
                            <Pressable onPress={() => setRole('provider')}><Text style={{ color: role === 'provider' ? colors.primary : colors.muted }}>Proveedor</Text></Pressable>
                        </View>
                        <Text style={{ marginTop: 8, marginBottom: 6, color: colors.muted }}>Género</Text>
                        <View style={{ flexDirection: 'row' }}>
                            <Pressable onPress={() => setGender('male')} style={{ marginRight: 12 }}><Text style={{ color: gender === 'male' ? colors.primary : colors.muted }}>Hombre</Text></Pressable>
                            <Pressable onPress={() => setGender('female')}><Text style={{ color: gender === 'female' ? colors.primary : colors.muted }}>Mujer</Text></Pressable>
                        </View>
                    </Animated.View>
                )}

                {mode === 'login' && (
                    <>
                    <Animated.View style={{ opacity: inputAnims[2], transform: [{ translateY: inputAnims[2].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                        <CustomInput type="email" value={email} title="Correo" onChange={setEmail} required />
                    </Animated.View>

                    <Animated.View style={{ opacity: inputAnims[3], transform: [{ translateY: inputAnims[3].interpolate({ inputRange: [0,1], outputRange: [8,0] }) }] }}>
                        <CustomInput type="password" value={password} title="Contraseña" onChange={setPassword} required />
                    </Animated.View>

                    {/* confirm handled inside register block; login doesn't need confirm */}
                    </>
                )}

                <View style={{ marginTop: 12 }}>
                    {mode === 'login' && savedAccounts && savedAccounts.length > 0 && (
                        <View style={{ marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Text style={{ color: colors.muted }}>Cuentas guardadas</Text>
                                    <Pressable onPress={() => setShowAccountsModal(true)}><Text style={{ color: colors.primary }}>Ver cuentas</Text></Pressable>
                                </View>
                                {/* Access accounts via modal */}
                        </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: colors.muted }}>Recordarme</Text>
                        <Switch value={remember} onValueChange={v => setRememberLocal(v)} />
                    </View>
                    {mode === 'login' ? (
                        <CustomButton title={i18n.t('signIn')} onPress={handleLogin} />
                    ) : (
                        <CustomButton title={i18n.t('signUp')} onPress={handleRegister} variant="secondary" />
                    )}

                    <CustomButton title="Volver" onPress={hideForm} variant="tertiary" />
                </View>
                </ScrollView>
            </Animated.View>
            {submitting && (
                <View style={styles.overlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: colors.muted, marginTop: 10 }}>Procesando...</Text>
                </View>
            )}
            <AccountsModal
                visible={showAccountsModal}
                onClose={() => setShowAccountsModal(false)}
                accounts={savedAccounts || []}
                onSelect={async (acc: any) => {
                    // attempt automatic sign-in using secure credentials
                    setShowAccountsModal(false);
                    try {
                        if (loginWithSavedAccount) {
                            setSubmitting(true);
                            await loginWithSavedAccount(acc.email);
                            // success: nothing else to do — auth state will navigate
                            return;
                        }
                        // fallback: prefill email only
                        setEmail(acc.email);
                        setMode('login');
                    } catch (e:any) {
                        // couldn't auto-login (no credentials or failed) -> prefill and show message
                        setEmail(acc.email);
                        setMode('login');
                        Alert.alert('Autologin falló', 'No se encontraron credenciales guardadas. Por favor ingresa tu contraseña.');
                    } finally {
                        setSubmitting(false);
                    }
                }}
                onRemove={(email: string) => { removeSavedAccount(email); }}
            />
        </View>
    );
}

// Modal component rendered inside the same file (simple, uses Login's savedAccounts)
function AccountsModal({ visible, onClose, accounts, onSelect, onRemove }: any) {
    const { colors } = useTheme();
    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                <View style={{ width: '86%', maxHeight: '70%', backgroundColor: colors.card, borderRadius: 12, padding: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Cuentas</Text>
                    <FlatList data={accounts} keyExtractor={(i:any)=>i.email} renderItem={({ item }: any) => (
                        <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            {item.displayName ? (
                                <>
                                    <Text style={{ color: colors.text, fontWeight: '700' }}>{item.displayName}</Text>
                                    <Text style={{ color: colors.muted, fontSize: 12 }}>{item.email}</Text>
                                </>
                            ) : (
                                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.email}</Text>
                            )}
                            <View style={{ flexDirection: 'row', marginTop: 8 }}>
                                <TouchableOpacity onPress={() => onSelect(item)} style={{ marginRight: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.primary, borderRadius: 8 }}>
                                    <Text style={{ color: '#fff' }}>Usar cuenta</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onRemove(item.email)} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 8 }}>
                                    <Text style={{ color: colors.text }}>Eliminar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )} />
                    <View style={{ marginTop: 12 }}>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Nota: para iniciar sesión automáticamente sin contraseña necesitas habilitar "guardar contraseña" de forma segura (Keychain/SecureStore). Esto no está activado por defecto.</Text>
                    </View>
                    <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
                        <TouchableOpacity onPress={onClose} style={{ paddingVertical: 8, paddingHorizontal: 12 }}><Text style={{ color: colors.primary }}>Cerrar</Text></TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    chooserCard: {
        width: '88%',
        borderRadius: 18,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
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
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 14,
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
    overlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)'
    }
});