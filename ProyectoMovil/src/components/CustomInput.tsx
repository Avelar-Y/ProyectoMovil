import { useState } from "react";
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { i18n } from "../contexts/LanguageContext";

type Props = {
    value: string;
    title: string;
    type?: 'text' | 'password' | 'email' | 'number' | 'numeric';
    onChange: (text: string) => void;
    icon?: string;
    required?: boolean;
}

export default function CustomInput({ value, title, type = "text", onChange, required }: Props) {
    const [isSecureText, setIsSecureText] = useState(type === 'password');
    const [isPasswordVisible, setIsPasswordVisible] = useState (false);
    const { colors } = useTheme();

    const isPasswordField = type==="password";
    const keyboardType: KeyboardTypeOptions = 
        type === 'email' ? 'email-address' : 
            type === 'number' ? 'number-pad' :
                type === 'numeric' ? 'numeric' :
                    'default';


    const getError = () => {
        // validacion de campos obligatorios
        if (required && !value)
            return "El campo es obligatorio";
        // evaluar si el correo tiene @
        if (type === "email" && !value.includes("@"))
            return i18n.t('invalidEmail');
        // evaluar longitud de contraseña 
        if (type == "password" && value.length < 4)
            return i18n.t('passwordMustBeStronger');
    }
    const error = getError();
    return (
        <View style={{ marginVertical: 6 }}>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBg, borderColor: colors.border }, error && styles.inputError]}>
                {/* left icon: show a context icon based on type if available */}
                <View style={styles.leftIcon}>
                    {(() => {
                        const icons: Record<string, string> = {
                            email: 'https://cdn-icons-png.flaticon.com/512/561/561127.png',
                            password: 'https://cdn-icons-png.flaticon.com/512/3064/3064197.png',
                            person: 'https://cdn-icons-png.flaticon.com/512/1077/1077114.png',
                        };
                        const key = type === 'email' ? 'email' : (type === 'password' ? 'password' : 'person');
                        return <Image source={{ uri: icons[key] }} style={{ width: 20, height: 20, tintColor: colors.primary }} />
                    })()}
                </View>

                <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder={title}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={isSecureText}
                    keyboardType={keyboardType}
                    placeholderTextColor={colors.muted}
                    underlineColorAndroid="transparent"
                />

                {isPasswordField && (
                    <TouchableOpacity
                        style={styles.rightIcon}
                        onPress={() => {
                            setIsPasswordVisible(!isPasswordVisible);
                            setIsSecureText(!isSecureText);
                        }}>
                        <Image source={{ uri: isPasswordVisible ? 'https://cdn-icons-png.flaticon.com/512/565/565655.png' : 'https://cdn-icons-png.flaticon.com/512/565/565654.png' }} style={{ width: 22, height: 22, tintColor: colors.primary }} />
                    </TouchableOpacity>
                )}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    input: {
        paddingVertical: 10,
        fontSize: 15,
        flex: 1,
        marginLeft: 6,
    },
    inputError: {
        borderColor: 'red',
    },
    error: {
        color: 'red',
        marginTop: 4,
        fontSize: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minHeight: 44,
    },
    leftIcon: {
        width: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rightIcon: {
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
});