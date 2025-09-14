import React from "react";
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import CustomButton from "../components/CustomButton";

export default function Home({ navigation }: any) {
    const { user } = useAuth();

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Image
                    source={{ uri: "https://cdn-icons-png.flaticon.com/512/565/565547.png" }}
                    style={styles.logo}
                />
                <Text style={styles.title}>Servicios Rápidos</Text>
                <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
                    <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' }} style={styles.profileIcon} />
                </TouchableOpacity>
            </View>

            {/* Bienvenida */}
            <Text style={styles.welcome}>¡Hola {user?.email || "Artista"}!</Text>
            <Text style={styles.subtitle}>
                Crea arte urbano y publicidad en el mundo real usando realidad aumentada.
            </Text>

            {/* Servicios rápidos */}
            <Text style={[styles.subtitle, { marginTop: 6 }]}>Elige un servicio</Text>
            <View style={styles.servicesContainer}>
                {[
                    { key: 'plumber', title: 'Fontanería', icon: 'https://cdn-icons-png.flaticon.com/512/2921/2921222.png' },
                    { key: 'painter', title: 'Pintor', icon: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png' },
                    { key: 'electrician', title: 'Electricista', icon: 'https://cdn-icons-png.flaticon.com/512/2321/2321406.png' },
                    { key: 'musician', title: 'Músico', icon: 'https://cdn-icons-png.flaticon.com/512/727/727218.png' },
                    { key: 'field', title: 'Trabajos de campo', icon: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' },
                ].map(s => (
                    <TouchableOpacity key={s.key} style={styles.serviceCard} onPress={() => navigation.navigate('ServiceDetail', { service: s.key })}>
                        <Image source={{ uri: s.icon }} style={styles.cardIcon} />
                        <Text style={styles.cardTitle}>{s.title}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Botón para ir a la cámara AR (placeholder) */}
            <CustomButton
                title="Ver detalles del servicio"
                onPress={() => Alert && Alert.alert ? Alert.alert('Info', 'Selecciona un servicio para más opciones') : null}
                variant="primary"
            />

            {/* Inspiración */}
            <Text style={styles.inspirationTitle}>Inspírate</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.inspirationScroll}>
                <Image
                    source={{ uri: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=400&q=80" }}
                    style={styles.inspirationImg}
                />
                <Image
                    source={{ uri: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80" }}
                    style={styles.inspirationImg}
                />
                <Image
                    source={{ uri: "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=400&q=80" }}
                    style={styles.inspirationImg}
                />
            </ScrollView>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        padding: 20,
        backgroundColor: "#ffffff",
        flexGrow: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    logo: {
        width: 48,
        height: 48,
        marginRight: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#22223b",
    },
    welcome: {
        fontSize: 20,
        fontWeight: "600",
        marginVertical: 8,
        color: "#22223b",
    },
    subtitle: {
        fontSize: 16,
        color: "#4a4e69",
        marginBottom: 18,
        textAlign: "center",
    },
    cardsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        marginBottom: 20,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        width: 150,
        marginHorizontal: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardIcon: {
        width: 40,
        height: 40,
        marginBottom: 8,
    },
    cardTitle: {
        fontWeight: "bold",
        fontSize: 16,
        color: "#22223b",
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 13,
        color: "#4a4e69",
        textAlign: "center",
    },
    inspirationTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#22223b",
        marginTop: 24,
        marginBottom: 8,
        alignSelf: "flex-start",
    },
    inspirationScroll: {
        flexDirection: "row",
        marginBottom: 20,
    },
    inspirationImg: {
        width: 120,
        height: 80,
        borderRadius: 10,
        marginRight: 10,
    },
    profileBtn: {
        position: 'absolute',
        right: 12,
        top: 4,
        padding: 6,
    },
    profileIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    servicesContainer: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    serviceCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        width: '30%',
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
});