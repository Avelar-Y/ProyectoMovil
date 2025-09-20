import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
// @ts-ignore
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
import Home from '../screens/Home';
import Login from '../screens/Login';
import Profile from '../screens/Profile';
import ServiceDetail from '../screens/ServiceDetail';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/firestoreService';
import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';
import ProviderTerms from '../screens/ProviderTerms';
import ProviderDashboard from '../screens/ProviderDashboard';
import History from '../screens/History';
import { View, Text, Platform, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const CustomTabBar = ({ state, descriptors, navigation }: any) => {
    const { colors } = useTheme();
    return (
        <View style={{
            flexDirection:'row', backgroundColor: colors.tabBar || colors.surface, borderRadius:26, marginHorizontal:16,
            paddingHorizontal:10, paddingTop:8, paddingBottom: Platform.OS==='ios'?28:14, position:'absolute', left:0, right:0, bottom:10,
            shadowColor:'#000', shadowOpacity:0.15, shadowRadius:12, shadowOffset:{ width:0, height:4 }, elevation:10
        }}>
            {state.routes.map((route: any, index: number) => {
                const focused = state.index === index;
                const onPress = () => {
                    const event = navigation.emit({ type:'tabPress', target:route.key, canPreventDefault:true });
                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
                };
                const onLongPress = () => navigation.emit({ type:'tabLongPress', target: route.key });
                const icons: Record<string,string> = {
                    Chat: 'https://cdn-icons-png.flaticon.com/512/2462/2462719.png',
                    Explore: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                    History: 'https://cdn-icons-png.flaticon.com/512/545/545682.png',
                    Provider: 'https://cdn-icons-png.flaticon.com/512/3707/3707225.png',
                    Profile: 'https://cdn-icons-png.flaticon.com/512/747/747376.png'
                };
                const uri = icons[route.name] || icons.Explore;
                return (
                    <TouchableOpacity key={route.key} accessibilityRole='button' accessibilityState={focused?{selected:true}:{}} onPress={onPress} onLongPress={onLongPress} style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
                        <View style={{ padding:10, borderRadius:18, backgroundColor: focused ? colors.highlight : 'transparent' }}>
                            <Image source={{ uri }} style={{ width:26, height:26, tintColor: focused ? colors.primary : colors.muted }} />
                        </View>
                        <Text style={{ fontSize:11, marginTop:2, color: focused ? colors.primary : colors.muted }}>{descriptors[route.key].options.title || route.name}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

function UserTabs() {
    return (
        <Tab.Navigator screenOptions={{ headerShown:false, tabBarShowLabel:false }} tabBar={(p:any)=><CustomTabBar {...p} />}> 
            <Tab.Screen name='Chat' component={require('../screens/Chat').default} />
            <Tab.Screen name='Explore' component={Home} />
            <Tab.Screen name='History' component={History} />
            <Tab.Screen name='Profile' component={Profile} />
        </Tab.Navigator>
    );
}

function ProviderTabs() {
    return (
        <Tab.Navigator screenOptions={{ headerShown:false, tabBarShowLabel:false }} tabBar={(p:any)=><CustomTabBar {...p} />}> 
            <Tab.Screen name='Chat' component={require('../screens/Chat').default} />
            <Tab.Screen name='Explore' component={Home} />
            <Tab.Screen name='History' component={History} />
            <Tab.Screen name='Provider' component={ProviderDashboard} />
            <Tab.Screen name='Profile' component={Profile} />
        </Tab.Navigator>
    );
}

function MainTabs() {
    const { user } = useAuth();
    const [role, setRole] = React.useState<'user'|'provider'>('user');

    // Carga inicial + listener tiempo real (cambia inmediatamente las tabs al salir o entrar modo proveedor)
    React.useEffect(()=>{
        let cancelled = false;
        if (!user?.uid) { setRole('user'); return; }
        // fetch inicial (rápido) para evitar parpadeo
        (async ()=>{
            try {
                const profile = await getUserProfile(user.uid!);
                if (!cancelled) setRole(profile?.role === 'provider' ? 'provider' : 'user');
            } catch { if (!cancelled) setRole('user'); }
        })();
        // suscripción en tiempo real
        const ref = doc(getFirestore(), 'users', user.uid);
        const unsub = onSnapshot(ref, snap => {
            if (!snap.exists()) { if (!cancelled) setRole('user'); return; }
            const data: any = snap.data();
            const newRole = data?.role === 'provider' ? 'provider' : 'user';
            setRole(prev => prev === newRole ? prev : newRole);
        }, () => { if (!cancelled) setRole('user'); });
        return () => { cancelled = true; unsub(); };
    }, [user?.uid]);

    return role === 'provider' ? <ProviderTabs /> : <UserTabs />;
}

export default function AppNavigator({ isLoggedIn }: { isLoggedIn: boolean }) {
    return (
        <Stack.Navigator screenOptions={{ headerShown:false }}>
            {isLoggedIn ? (
                <>
                    <Stack.Screen name="Main" component={MainTabs} />
                    <Stack.Screen name="ProviderTerms" component={ProviderTerms} />
                    <Stack.Screen name="ProviderDashboard" component={ProviderDashboard} />
                    <Stack.Screen name="ServiceDetail" component={ServiceDetail} options={{ presentation:'modal', headerShown:false }} />
                    <Stack.Screen name="ActiveReservationDetail" component={require('../screens/ActiveReservationDetail').default} options={{ presentation:'modal', headerShown:false }} />
                    <Stack.Screen name="ReservationSummary" component={require('../screens/ReservationSummary').default} options={{ presentation:'modal', headerShown:false }} />
                    <Stack.Screen name="ChatRoom" component={require('../screens/ChatRoom').default} />
                    <Stack.Screen name="ProviderLiveRoute" component={require('../screens/ProviderLiveRoute').default} options={{ presentation:'modal', headerShown:false }} />
                    <Stack.Screen name="ProviderFinanceDashboard" component={require('../screens/ProviderFinanceDashboard').default} options={{ presentation:'modal', headerShown:false }} />
                    <Stack.Screen name="ClientFinanceHistory" component={require('../screens/ClientFinanceHistory').default} options={{ presentation:'modal', headerShown:false }} />
                </>
            ) : (
                <Stack.Screen name="Login" component={Login} />
            )}
        </Stack.Navigator>
    );
}
