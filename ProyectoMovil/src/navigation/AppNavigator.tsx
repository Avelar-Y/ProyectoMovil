import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
// Usar require dinámico para evitar error si '@react-navigation/bottom-tabs' no está instalado en el entorno
// Si instalas el paquete, se puede cambiar de nuevo a import estático.
// @ts-ignore
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
import Home from "../screens/Home";
import ProviderHomeMinimal from "../screens/ProviderHomeMinimal";
import Login from "../screens/Login";
import Profile from "../screens/Profile";
import ServiceDetail from "../screens/ServiceDetail";
// usar require dinámico para evitar error de tipos en entornos donde no se transpila aún
const ServiceReservations = require('../screens/ServiceReservations').default;
import AddService from "../screens/AddService";
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getUserProfile } from '../services/firestoreService';
import History from "../screens/History";
// import Chat from "../screens/Chat";
import { View, Text, Platform, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { RouteProp } from '@react-navigation/native';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [isProvider, setIsProvider] = useState<boolean | null>(null);

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
    // Ensure Hooks are called in the same order on every render.
    const ExploreComp = React.useMemo(() => (isProvider ? ProviderHomeMinimal : Home), [isProvider]);

    if (isProvider === null) {
        // still determining role: show a lightweight loader to avoid remounts of the tabs
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarShowLabel: false,
            }}
            tabBar={({ state, descriptors, navigation }: any) => {
                return (
                    <View style={{
                        flexDirection: 'row',
                        backgroundColor: colors.tabBar || colors.surface,
                        borderRadius: 26,
                        marginHorizontal: 16,
                        paddingHorizontal: 10,
                        paddingTop: 8,
                        paddingBottom: Platform.OS === 'ios' ? 28 : 14,
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 10,
                        shadowColor: '#000',
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 4 },
                        elevation: 10,
                    }}>
                        {state.routes.map((route: any, index: number) => {
                            const focused = state.index === index;
                            const onPress = () => {
                                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                                if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
                            };
                            const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
                            const icons: Record<string, string> = {
                                Chat: 'https://cdn-icons-png.flaticon.com/512/2462/2462719.png',
                                Explore: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                                History: 'https://cdn-icons-png.flaticon.com/512/545/545682.png',
                                Profile: 'https://cdn-icons-png.flaticon.com/512/747/747376.png',
                                ActiveServices: 'https://cdn-icons-png.flaticon.com/512/3707/3707225.png',
                                CreateService: 'https://cdn-icons-png.flaticon.com/512/992/992651.png',
                                MyServices: 'https://cdn-icons-png.flaticon.com/512/1828/1828911.png',
                            };
                            const uri = icons[route.name] || icons.Explore;
                            return (
                                <TouchableOpacity
                                    key={route.key}
                                    accessibilityRole="button"
                                    accessibilityState={focused ? { selected: true } : {}}
                                    accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
                                    testID={descriptors[route.key].options.tabBarTestID}
                                    onPress={onPress}
                                    onLongPress={onLongPress}
                                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <View style={{
                                        padding: 10,
                                        borderRadius: 18,
                                        backgroundColor: focused ? colors.highlight : 'transparent'
                                    }}>
                                        <Image source={{ uri }} style={{ width: 26, height: 26, tintColor: focused ? colors.primary : colors.muted }} />
                                    </View>
                                    <Text style={{ fontSize: 11, marginTop: 2, color: focused ? colors.primary : colors.muted }}>
                                        {descriptors[route.key].options.title || route.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                );
            }}
        >
            <Tab.Screen name="Chat" component={require('../screens/Chat').default} />
            <Tab.Screen name="Explore" component={ExploreComp} />
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
                        <Stack.Screen name="ServiceDetail" component={ServiceDetail} options={{ presentation: 'modal', headerShown: false }} />
                        <Stack.Screen name="ServiceReservations" component={ServiceReservations} options={{ title: 'Reservas del servicio' }} />
                        <Stack.Screen name="ActiveReservationDetail" component={require('../screens/ActiveReservationDetail').default} options={{ presentation: 'modal', headerShown:false }} />
                        <Stack.Screen name="AddService" component={AddService} />
                        <Stack.Screen name="Chat" component={require('../screens/ChatRoom').default} />
                </>
            ) : (
                <Stack.Screen name="Login" component={Login} />
            )}
        </Stack.Navigator>
    );
}
