import { useState } from "react";
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
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
            <View style={[styles.inputContainer, error && styles.inputError]}>
                {/* left icon: show a context icon based on type if available */}
                <View style={styles.leftIcon}>
                    <Icon name={
                        type === 'email' ? 'email' :
                        type === 'password' ? 'lock' :
                        'person'
                    } size={20} color={'#9fb4ff'} />
                </View>

                <TextInput
                    style={styles.input}
                    placeholder={title}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={isSecureText}
                    keyboardType={keyboardType}
                    placeholderTextColor={'#9aa4b2'}
                    underlineColorAndroid="transparent"
                />

                {isPasswordField && (
                    <TouchableOpacity
                        style={styles.rightIcon}
                        onPress={() => {
                            setIsPasswordVisible(!isPasswordVisible);
                            setIsSecureText(!isSecureText);
                        }}>
                        <Icon
                            name={isPasswordVisible ? 'visibility-off' : 'visibility'}
                            size={22} color={'#9fb4ff'} />
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
        color: '#111827',
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
        borderColor: '#e6e6e6',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#ffffff',
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