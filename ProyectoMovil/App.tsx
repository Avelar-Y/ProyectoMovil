/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 * 
 * npm install -g npm-check-updates
 * npx npm-check-updates -u
    npm install
 */


import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

class ErrorBoundary extends React.Component<any, { error: any }>{
  constructor(props: any){
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any){
    return { error };
  }
  componentDidCatch(error: any, info: any){
    // could log to server
    console.error('ErrorBoundary caught', error, info);
  }
  render(){
    if (this.state.error){
      return (
        <ScrollView contentContainerStyle={styles.errContainer}>
          <Text style={styles.errTitle}>Se produjo un error</Text>
          <Text style={styles.errMsg}>{String(this.state.error)}</Text>
          <Text style={styles.errStack}>{this.state.error?.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

// Componente para decidir qué pantalla mostrar según el usuario
function MainApp() {
  const { user } = useAuth();
  return (
    <NavigationContainer>
      <AppNavigator isLoggedIn={!!user} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <ErrorBoundary>
          <MainApp />
        </ErrorBoundary>
      </AuthProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  errContainer: { flex: 1, padding: 20, backgroundColor: '#fff' },
  errTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#b91c1c' },
  errMsg: { color: '#111', marginBottom: 12 },
  errStack: { color: '#444', fontSize: 12 }
});
