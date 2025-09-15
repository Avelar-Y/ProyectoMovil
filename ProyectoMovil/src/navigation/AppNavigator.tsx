import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
// Usar require dinámico para evitar error si '@react-navigation/bottom-tabs' no está instalado en el entorno
// Si instalas el paquete, se puede cambiar de nuevo a import estático.
// @ts-ignore
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
import Home from "../screens/Home";
import ProviderHome from "../screens/ProviderHome";
import Login from "../screens/Login";
import Profile from "../screens/Profile";
import ServiceDetail from "../screens/ServiceDetail";
import AddService from "../screens/AddService";
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getUserProfile } from '../services/firestoreService';
import History from "../screens/History";
// import Chat from "../screens/Chat";
import { View, Text, Platform } from 'react-native';
import { Image } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { RouteProp } from '@react-navigation/native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [isProvider, setIsProvider] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const uid = (user as any)?.uid;
                if (!uid) {
                    if (mounted) setIsProvider(false);
                    return;
                }
                const p = await getUserProfile(uid);
                if (mounted) setIsProvider(p?.role === 'provider');
            } catch (e) {
                console.warn('MainTabs getUserProfile', e);
            }
        })();
        return () => { mounted = false };
    }, [user]);
    return (
        <Tab.Navigator
            screenOptions={({ route }: { route: RouteProp<Record<string, object | undefined>, string> }) => ({
                headerShown: false,
                tabBarShowLabel: true,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: 18,
                    borderTopRightRadius: 18,
                    height: Platform.OS === 'ios' ? 90 : 70,
                    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
                    position: 'absolute',
                    left: 10,
                    right: 10,
                    bottom: 10,
                    elevation: 5,
                },
                tabBarLabelStyle: { fontSize: 12 },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.muted,
                tabBarIcon: ({ color, size }: { color: string; size: number }) => {
                    // Usar imágenes remotas para asegurar que se vean sin depender de fuentes.
                    const icons: Record<string, string> = {
                        Chat: 'https://cdn-icons-png.flaticon.com/512/2462/2462719.png',
                        Explore: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                        History: 'https://cdn-icons-png.flaticon.com/512/545/545682.png',
                        Profile: 'https://cdn-icons-png.flaticon.com/512/747/747376.png',
                    };
                    const uri = icons[route.name] || icons.Explore;
                    return (
                        <Image source={{ uri }} style={{ width: size, height: size, tintColor: color }} />
                    );
                },
            })}
        >
            <Tab.Screen name="Chat" component={require('../screens/Chat').default} />
            <Tab.Screen name="Explore" component={isProvider ? ProviderHome : Home} />
        <Tab.Screen name="History" component={History} />
                                {/* Show ActiveServices tab only for regular users (not providers) */}
                                {!isProvider && (
                                    <Tab.Screen name="ActiveServices" component={require('../screens/ActiveServices').default} options={{ title: 'Servicios' }} />
                                )}
                {isProvider && (
                <Tab.Screen name="CreateService" component={AddService} options={{ title: 'Crear servicio' }} />
                )}
                {isProvider && (
                    <Tab.Screen name="MyServices" component={require('../screens/MyServices').default} options={{ title: 'Mis servicios' }} />
                )}
        <Tab.Screen name="Profile" component={Profile} />
        </Tab.Navigator>
    );
}

export default function AppNavigator({ isLoggedIn }: { isLoggedIn: boolean }) {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isLoggedIn ? (
                <>
                    <Stack.Screen name="Main" component={MainTabs} />
                        <Stack.Screen name="ServiceDetail" component={ServiceDetail} />
                        <Stack.Screen name="AddService" component={AddService} />
                        <Stack.Screen name="Chat" component={require('../screens/ChatRoom').default} />
                </>
            ) : (
                <Stack.Screen name="Login" component={Login} />
            )}
        </Stack.Navigator>
    );
}
