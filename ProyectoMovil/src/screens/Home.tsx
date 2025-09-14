import React from "react";
import { View, Text, StyleSheet, Image, ScrollView } from "react-native";
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
                <Text style={styles.title}>Mivo AR</Text>
            </View>

            {/* Bienvenida */}
            <Text style={styles.welcome}>¡Hola {user?.email || "Artista"}!</Text>
            <Text style={styles.subtitle}>
                Crea arte urbano y publicidad en el mundo real usando realidad aumentada.
            </Text>

            {/* Cards de funciones */}
            <View style={styles.cardsContainer}>
                <View style={styles.card}>
                    <Image
                        source={{ uri: "https://cdn-icons-png.flaticon.com/512/1828/1828884.png" }}
                        style={styles.cardIcon}
                    />
                    <Text style={styles.cardTitle}>Crea tu arte</Text>
                    <Text style={styles.cardDesc}>Diseña y deja tu huella en cualquier espacio urbano.</Text>
                </View>
                <View style={styles.card}>
                    <Image
                        source={{ uri: "https://cdn-icons-png.flaticon.com/512/854/854878.png" }}
                        style={styles.cardIcon}
                    />
                    <Text style={styles.cardTitle}>Explora campañas</Text>
                    <Text style={styles.cardDesc}>Descubre arte y publicidad AR cerca de ti.</Text>
                </View>
            </View>

            {/* Botón para ir a la cámara AR */}
            <CustomButton
                title="Entrar a la cámara AR"
                onPress={() => navigation && navigation.navigate ? navigation.navigate("ARCamera") : null}
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
        backgroundColor: "#f5f6fa",
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
});