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
// Eliminadas pantallas de proveedor (ServiceReservations, AddService, etc.)
import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { getUserProfile } from '../services/firestoreService';
import ProviderTerms from '../screens/ProviderTerms';
import ProviderDashboard from '../screens/ProviderDashboard';
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
    const [role, setRole] = React.useState<'user'|'provider'|'unknown'>('unknown');
    React.useEffect(()=>{
        let mounted = true;
        (async ()=>{
            try {
                if (!user?.uid) { if(mounted) setRole('user'); return; }
                const profile = await getUserProfile(user.uid);
                if (mounted) setRole(profile?.role === 'provider' ? 'provider' : 'user');
            } catch { if(mounted) setRole('user'); }
        })();
        return ()=>{ mounted=false };
    },[user]);
    const ExploreComp = Home;
    const isProvider = role === 'provider';

    const tabs: Array<{ name:string; component:any }> = [
        { name: 'Chat', component: require('../screens/Chat').default },
        { name: 'Explore', component: ExploreComp },
        { name: 'History', component: History },
        ...(isProvider ? [{ name: 'Provider', component: ProviderDashboard }] : []),
        { name: 'Profile', component: Profile },
    ];

    return (
        <Tab.Navigator
            screenOptions={{ headerShown: false, tabBarShowLabel:false }}
            tabBar={({ state, descriptors, navigation }: any) => (
                <View style={{
                    flexDirection: 'row',
                    backgroundColor: colors.tabBar || colors.surface,
                    borderRadius: 26,
                    marginHorizontal: 16,
                    paddingHorizontal: 10,
                    paddingTop: 8,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
                    position: 'absolute', left:0, right:0, bottom:10,
                    shadowColor:'#000', shadowOpacity:0.15, shadowRadius:12, shadowOffset:{ width:0, height:4 }, elevation:10
                }}>
                    {state.routes.map((route: any, index: number) => {
                        const focused = state.index === index;
                        const onPress = () => {
                            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
                        };
                        const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
                        const icons: Record<string,string> = {
                            Chat: 'https://cdn-icons-png.flaticon.com/512/2462/2462719.png',
                            Explore: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                            History: 'https://cdn-icons-png.flaticon.com/512/545/545682.png',
                            Profile: 'https://cdn-icons-png.flaticon.com/512/747/747376.png',
                            Provider: 'https://cdn-icons-png.flaticon.com/512/3707/3707225.png'
                        };
                        const uri = icons[route.name] || icons.Explore;
                        return (
                            <TouchableOpacity key={route.key} accessibilityRole="button" accessibilityState={focused ? { selected:true } : {}} onPress={onPress} onLongPress={onLongPress} style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                                <View style={{ padding:10, borderRadius:18, backgroundColor: focused ? colors.highlight : 'transparent' }}>
                                    <Image source={{ uri }} style={{ width:26, height:26, tintColor: focused ? colors.primary : colors.muted }} />
                                </View>
                                <Text style={{ fontSize:11, marginTop:2, color: focused ? colors.primary : colors.muted }}>{descriptors[route.key].options.title || route.name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        >
            {tabs.map(t => <Tab.Screen key={t.name} name={t.name} component={t.component} />)}
        </Tab.Navigator>
    );
}

export default function AppNavigator({ isLoggedIn }: { isLoggedIn: boolean }) {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isLoggedIn ? (
                <>
                    <Stack.Screen name="Main" component={MainTabs} />
                    <Stack.Screen name="ProviderTerms" component={ProviderTerms} />
                    <Stack.Screen name="ProviderDashboard" component={ProviderDashboard} />
                        <Stack.Screen name="ServiceDetail" component={ServiceDetail} options={{ presentation: 'modal', headerShown: false }} />
                        <Stack.Screen name="ActiveReservationDetail" component={require('../screens/ActiveReservationDetail').default} options={{ presentation: 'modal', headerShown:false }} />
                        <Stack.Screen name="Chat" component={require('../screens/ChatRoom').default} />
                </>
            ) : (
                <Stack.Screen name="Login" component={Login} />
            )}
        </Stack.Navigator>
    );
}
