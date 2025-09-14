import { createContext, useContext, useState } from "react"
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '@react-native-firebase/auth';

type User = {
    email: string,
} | null;

const AuthContext = createContext<{
    user: User,
    isAllowed: Boolean,
    login: (email: string, password: string) => Promise<void>,
    register: (email: string, password: string) => Promise<void>,
    logout: () => void,
} | null>(null);

//medio para exponer la manipulacion de estado a la aplicacion o componentes hijos
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User>(null);
    const [isAllowed, setIsAllowed] = useState<Boolean>(false);

    const login = async (email: string, password: string) => {
        try {
            const auth = getAuth();
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            setUser({ email: userCredential.user.email ?? '' });
            setIsAllowed(true);
        } catch (error: any) {
            setIsAllowed(false);
            throw error;
        }
    }
    const register = async (email: string, password: string) => {
        try {
            const auth = getAuth();
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            setUser({ email: userCredential.user.email ?? '' });
            setIsAllowed(true);
        } catch (error: any) {
            setIsAllowed(false);
            throw error;
        }
    }
    const logout = async () => {
        const auth = getAuth();
        await signOut(auth);
        setUser(null);
        setIsAllowed(false);
    }
    return (
        <AuthContext.Provider value={{ user, isAllowed, login, register, logout }}>
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