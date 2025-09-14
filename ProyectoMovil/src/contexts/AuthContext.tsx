import { createContext, useContext, useEffect, useState } from "react";
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type User = {
    uid: string;
    email: string;
} | null;

const AuthContext = createContext<{
    user: User,
    isAllowed: Boolean,
    loading: boolean,
    login: (email: string, password: string) => Promise<void>,
    register: (email: string, password: string) => Promise<void>,
    logout: () => void,
} | null>(null);

//medio para exponer la manipulacion de estado a la aplicacion o componentes hijos
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User>(null);
    const [isAllowed, setIsAllowed] = useState<Boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const unsub = auth().onAuthStateChanged((u: FirebaseAuthTypes.User | null) => {
            if (u) {
                setUser({ uid: u.uid, email: u.email ?? '' });
                setIsAllowed(true);
            } else {
                setUser(null);
                setIsAllowed(false);
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const userCredential = await auth().signInWithEmailAndPassword(email, password);
            const u = userCredential.user;
            setUser({ uid: u.uid, email: u.email ?? '' });
            setIsAllowed(true);
            // Actualizar/crear perfil en users collection
            try {
                await firestore().collection('users').doc(u.uid).set({
                    email: u.email,
                    displayName: u.displayName || '',
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch (e) {
                console.warn('update user doc error', e);
            }
        } catch (error: any) {
            setIsAllowed(false);
            throw error;
        }
    };

    const register = async (email: string, password: string) => {
        try {
            const userCredential = await auth().createUserWithEmailAndPassword(email, password);
            const u = userCredential.user;
            setUser({ uid: u.uid, email: u.email ?? '' });
            setIsAllowed(true);
            // Crear documento de usuario básico
            try {
                await firestore().collection('users').doc(u.uid).set({
                    email: u.email,
                    displayName: u.displayName || '',
                    createdAt: firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            } catch (e) {
                console.warn('create user doc error', e);
            }
        } catch (error: any) {
            setIsAllowed(false);
            throw error;
        }
    };

    const logout = async () => {
        await auth().signOut();
        setUser(null);
        setIsAllowed(false);
    };
    return (
        <AuthContext.Provider value={{ user, isAllowed, loading, login, register, logout }}>
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