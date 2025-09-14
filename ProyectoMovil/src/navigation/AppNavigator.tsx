import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
// Usar require dinámico para evitar error si '@react-navigation/bottom-tabs' no está instalado en el entorno
// Si instalas el paquete, se puede cambiar de nuevo a import estático.
// @ts-ignore
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
import Home from "../screens/Home";
import Login from "../screens/Login";
import Profile from "../screens/Profile";
import ServiceDetail from "../screens/ServiceDetail";
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
            {/* <Tab.Screen name="Chat" component={Chat} /> */}
            <Tab.Screen name="Explore" component={Home} />
            <Tab.Screen name="History" component={History} />
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
                </>
            ) : (
                <Stack.Screen name="Login" component={Login} />
            )}
        </Stack.Navigator>
    );
}
