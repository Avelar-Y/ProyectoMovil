import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    FirebaseAuthTypes,
} from '@react-native-firebase/auth';
// removed direct firestore import; user document operations go through ../services/firestoreService
import { updateUserProfile, getUserProfile } from '../services/firestoreService';

type User = {
    uid: string;
    email: string;
} | null;

const REMEMBER_KEY = '@auth.remember';
const ACCOUNTS_KEY = '@auth.accounts';
const CREDENTIALS_SERVICE = 'com.proyectomovil.credentials';

// helper to detect if native Keychain module is linked/available
const isKeychainAvailable = () => {
    try {
        return typeof (Keychain as any)?.setGenericPassword === 'function' && typeof (Keychain as any)?.getGenericPassword === 'function';
    } catch (e) {
        return false;
    }
};

const AuthContext = createContext<{
    user: User,
    isAllowed: Boolean,
    loading: boolean,
    login: (email: string, password: string, remember?: boolean) => Promise<void>,
    loginWithSavedAccount?: (email: string) => Promise<void>,
    register: (email: string, password: string, name?: string, phone?: string, avatarUrl?: string, role?: string, gender?: 'male' | 'female' | 'other', remember?: boolean) => Promise<void>,
    logout: () => void,
    remember: boolean,
    setRemember: (v: boolean) => Promise<void>,
    savedAccounts: Array<{ email: string, uid?: string, displayName?: string, lastUsed?: number }>,
    saveAccount: (email: string, uid?: string) => Promise<void>,
    removeSavedAccount: (email: string) => Promise<void>,
    saveCredentials: (email: string, password: string) => Promise<void>,
    removeCredentials: (email: string) => Promise<void>,
} | null>(null);

//medio para exponer la manipulacion de estado a la aplicacion o componentes hijos
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User>(null);
    const [isAllowed, setIsAllowed] = useState<Boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    // Bandera para evitar múltiples actualizaciones en tiempo real
    const updateLockRef = useRef(false);
    useEffect(() => {
        let unsub: (() => void) | null = null;
        // read persisted remember flag into state on mount
        (async () => {
            try {
                const v = await AsyncStorage.getItem(REMEMBER_KEY);
                setRememberState(v === '1');
            } catch (e) {
                console.warn('AuthProvider read remember flag failed', e);
            }
        })();

        const auth = getAuth();
        unsub = onAuthStateChanged(auth, async (u: FirebaseAuthTypes.User | null) => {
            // Limitar la actualización en tiempo real usando la bandera
            if (updateLockRef.current) return;
            updateLockRef.current = true;
            setTimeout(() => { updateLockRef.current = false; }, 500); // 500ms de bloqueo

            if (u) {
                try {
                    const v = await AsyncStorage.getItem(REMEMBER_KEY);
                    const rememberedNow = v === '1';
                    if (!rememberedNow && !sessionTemporaryRef.current) {
                        try {
                            await signOut(auth);
                        } catch (e) {
                            console.warn('AuthProvider forced signOut failed', e);
                        }
                        if (user !== null) setUser(null);
                        if (isAllowed !== false) setIsAllowed(false);
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn('AuthProvider checking remember flag failed', e);
                }
                if (!user || user.uid !== u.uid) setUser({ uid: u.uid, email: u.email ?? '' });
                if (!isAllowed) setIsAllowed(true);
            } else {
                if (user !== null) setUser(null);
                if (isAllowed !== false) setIsAllowed(false);
            }
            setLoading(false);
        });
        return () => {
            if (unsub) unsub();
        };
    }, []);

    // in-memory ref used to mark a login that should be temporary only for this run
    const sessionTemporaryRef = useRef(false);
    const [rememberState, setRememberState] = useState<boolean>(false);
    const [savedAccounts, setSavedAccounts] = useState<Array<{ email: string, lastUsed?: number }>>([]);

    const login = async (email: string, password: string, remember: boolean = true) => {
        try {
            const auth = getAuth();
            // mark session temporary if user chose not to be remembered
            if (!remember) {
                sessionTemporaryRef.current = true;
                try { await AsyncStorage.removeItem(REMEMBER_KEY); } catch (e) { /* ignore */ }
            } else {
                try { await AsyncStorage.setItem(REMEMBER_KEY, '1'); } catch (e) { /* ignore */ }
            }
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const u = userCredential.user as FirebaseAuthTypes.User;
            // Only update if different
            if ((user as any)?.uid !== u.uid) setUser({ uid: u.uid, email: u.email ?? '' });
            if (!isAllowed) setIsAllowed(true);
            // if remember, also add to saved accounts (now that we have uid) and save credentials
            if (remember) {
                try { await saveAccount(email, u.uid); } catch (e) { /* ignore */ }
                // also save credentials securely if Keychain native module is available
                if (isKeychainAvailable()) {
                    try { await Keychain.setGenericPassword(email, password, { service: `${CREDENTIALS_SERVICE}:${email}` }); } catch (e) { console.warn('Keychain save failed', e); }
                } else {
                    console.warn('Keychain native module not available - skipping secure credential save');
                }
            }
            // Actualizar/crear perfil en users collection solo si hay cambios relevantes
            try {
                const currentProfile = await getUserProfile(u.uid);
                const newDisplayName = (u as any).displayName || '';
                if (!currentProfile || currentProfile.email !== u.email || currentProfile.displayName !== newDisplayName) {
                    await updateUserProfile(u.uid, {
                        email: u.email,
                        displayName: newDisplayName,
                    });
                }
            } catch (e) {
                console.warn('update user doc error', e);
            }
        } catch (error: any) {
            setIsAllowed(false);
            throw error;
        }
    };

    // attempt login using saved secure credentials for an email
    const loginWithSavedAccount = React.useCallback(async (email: string) => {
        try {
            if (!isKeychainAvailable()) throw new Error('No secure storage available');
            const creds = await Keychain.getGenericPassword({ service: `${CREDENTIALS_SERVICE}:${email}` });
            if (!creds) throw new Error('No stored credentials');
            const storedPassword = creds.password;
            await login(email, storedPassword, true);
        } catch (e) {
            // surface error so callers can fallback to manual login
            throw e;
        }
    }, [login]);

    const register = async (email: string, password: string, name?: string, phone?: string, avatarUrl?: string, role?: string, gender?: 'male' | 'female' | 'other', remember: boolean = true) => {
        try {
            const auth = getAuth();
            if (!remember) {
                sessionTemporaryRef.current = true;
                try { await AsyncStorage.removeItem(REMEMBER_KEY); } catch (e) { /* ignore */ }
            } else {
                try { await AsyncStorage.setItem(REMEMBER_KEY, '1'); } catch (e) { /* ignore */ }
            }
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const u = userCredential.user as FirebaseAuthTypes.User;
            // actualizar displayName en Firebase Auth si se proporcionó
            if (name) {
                try {
                    await updateProfile(u, { displayName: name });
                } catch (e) {
                    console.warn('updateProfile error', e);
                }
            }
            if ((user as any)?.uid !== u.uid) setUser({ uid: u.uid, email: u.email ?? '' });
            if (!isAllowed) setIsAllowed(true);
            // Crear documento de usuario básico
            try {
                // if avatarUrl is not provided, choose a sensible default based on gender
                const defaultMale = 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png';
                const defaultFemale = 'https://cdn-icons-png.flaticon.com/512/194/194938.png';
                const defaultOther = 'https://cdn-icons-png.flaticon.com/512/4128/4128176.png';
                const chosenAvatar = avatarUrl && avatarUrl.length > 0 ? avatarUrl : (gender === 'female' ? defaultFemale : gender === 'male' ? defaultMale : defaultOther);

                await updateUserProfile(u.uid, {
                    email: u.email,
                    displayName: name || (u as any).displayName || '',
                    name: name || (u as any).displayName || '',
                    phone: phone || '',
                    avatarUrl: chosenAvatar,
                    role: role || 'user',
                });
                // save account now that user doc exists
                if (remember) {
                    try { await saveAccount(email, u.uid); } catch (e) { /* ignore */ }
                }
            } catch (e) {
                console.warn('create user doc error', e);
            }
        } catch (error: any) {
            setIsAllowed(false);
            throw error;
        }
    };

    const refreshSavedAccountsDisplayNames = React.useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            let changed = false;
            const updated: any[] = [];
            for (const e of parsed) {
                if (!e || !e.email) continue;
                const entry: any = { email: e.email, uid: e.uid, displayName: e.displayName, lastUsed: e.lastUsed };
                if (entry.uid) {
                    try {
                        const profile = await getUserProfile(entry.uid);
                        if (profile && profile.displayName && profile.displayName !== entry.displayName) {
                            entry.displayName = profile.displayName;
                            changed = true;
                        }
                    } catch (err) {
                        // ignore per-account errors
                    }
                }
                updated.push(entry);
            }
            if (changed) {
                await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
                setSavedAccounts(updated);
            }
        } catch (err) {
            console.warn('refreshSavedAccountsDisplayNames failed', err);
        }
    }, []);

    const logout = React.useCallback(async () => {
        const auth = getAuth();
        try {
            // Limitar la actualización en tiempo real usando la bandera
            if (updateLockRef.current) return;
            updateLockRef.current = true;
            setTimeout(() => { updateLockRef.current = false; }, 500);
            // Attempt to refresh saved accounts so displayName changes are reflected before we sign out
            try { await refreshSavedAccountsDisplayNames(); } catch (e) { /* ignore */ }
            await signOut(auth);
        } catch (e) {
            // don't throw — callers may not handle this and it can crash the UI
            console.warn('AuthContext logout error', e);
        } finally {
            // ensure local state is cleared even if signOut failed locally
            if (user !== null) setUser(null);
            if (isAllowed !== false) setIsAllowed(false);
            // clear persisted remember flag on explicit logout
            try { await AsyncStorage.removeItem(REMEMBER_KEY); } catch (e) { /* ignore */ }
        }
    }, [refreshSavedAccountsDisplayNames, user, isAllowed]);

    const loadSavedAccounts = React.useCallback(async () => {
        try {
            const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
            if (!raw) return setSavedAccounts([]);
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return setSavedAccounts([]);
            // normalize entries: older entries may be just { email }
            const normalized: Array<{ email: string, uid?: string, displayName?: string, lastUsed?: number }> = [];
            for (const e of parsed) {
                if (!e || !e.email) continue;
                const entry: any = { email: e.email, lastUsed: e.lastUsed };
                if (e.uid) entry.uid = e.uid;
                if (e.displayName) entry.displayName = e.displayName;
                // if we have uid but no displayName, try to fetch it
                if (entry.uid && !entry.displayName) {
                    try {
                        const profile = await getUserProfile(entry.uid);
                        if (profile && profile.displayName) entry.displayName = profile.displayName;
                    } catch (err) {
                        // ignore
                    }
                }
                normalized.push(entry);
            }
            setSavedAccounts(normalized);
        } catch (e) {
            console.warn('loadSavedAccounts failed', e);
        }
    }, []);

    const saveAccount = React.useCallback(async (email: string, uid?: string) => {
        try {
            const now = Date.now();
            let displayName: string | undefined = undefined;
            if (uid) {
                try {
                    const profile = await getUserProfile(uid);
                    if (profile && profile.displayName) displayName = profile.displayName;
                } catch (err) {
                    // ignore profile fetch errors
                }
            }
            const next = [{ email, uid, displayName, lastUsed: now }, ...savedAccounts.filter(s => s.email !== email)];
            await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
            setSavedAccounts(next);
        } catch (e) { console.warn('saveAccount failed', e); }
    }, [savedAccounts]);

    const removeSavedAccount = React.useCallback(async (email: string) => {
        try {
            const next = savedAccounts.filter(s => s.email !== email);
            await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(next));
            setSavedAccounts(next);
            // also remove stored credentials if present and available
            if (isKeychainAvailable()) {
                try { await Keychain.resetGenericPassword({ service: `${CREDENTIALS_SERVICE}:${email}` }); } catch (e) { /* ignore */ }
            }
        } catch (e) { console.warn('removeSavedAccount failed', e); }
    }, [savedAccounts]);

    // load saved accounts on mount
    React.useEffect(() => { loadSavedAccounts(); }, [loadSavedAccounts]);

    const setRemember = React.useCallback(async (v: boolean) => {
        try {
            if (v) await AsyncStorage.setItem(REMEMBER_KEY, '1');
            else await AsyncStorage.removeItem(REMEMBER_KEY);
            setRememberState(v);
        } catch (e) { console.warn('setRemember failed', e); }
    }, []);

    const saveCredentials = React.useCallback(async (email: string, password: string) => {
        try {
            if (!isKeychainAvailable()) {
                console.warn('Keychain native module not available - cannot save credentials');
                return;
            }
            await Keychain.setGenericPassword(email, password, { service: `${CREDENTIALS_SERVICE}:${email}` });
        } catch (e) { console.warn('saveCredentials failed', e); }
    }, []);

    const removeCredentials = React.useCallback(async (email: string) => {
        try {
            if (!isKeychainAvailable()) return;
            await Keychain.resetGenericPassword({ service: `${CREDENTIALS_SERVICE}:${email}` });
        } catch (e) { /* ignore */ }
    }, []);

    const value = React.useMemo(() => ({ user, isAllowed, loading, login, register, logout, remember: rememberState, setRemember, savedAccounts, saveAccount, removeSavedAccount, loginWithSavedAccount, saveCredentials, removeCredentials, refreshSavedAccountsDisplayNames }), [user, isAllowed, loading, logout, rememberState, setRemember, savedAccounts, saveAccount, removeSavedAccount, loginWithSavedAccount, saveCredentials, removeCredentials, refreshSavedAccountsDisplayNames]);
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

//hook para utilizar el contexto en componentes personalizados (e.g login, home)
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
    return context;
}