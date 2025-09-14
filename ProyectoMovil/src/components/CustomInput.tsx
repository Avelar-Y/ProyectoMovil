import { useState } from "react";
import { KeyboardTypeOptions, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { i18n } from "../contexts/LanguageContext";

type Props = {
    value: string;
    title: string;
    type?: 'text' | 'password' | 'email' | 'number' | 'numeric';
    onChange: (text: string) => void;
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
        <View >
            <View style={[
                styles.inputContainer,
                error && styles.inputError]}>
                <TextInput
                    style={styles.input}
                    placeholder={title}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={isSecureText}
                    keyboardType={keyboardType}
                />
                 {isPasswordField && (
                    <TouchableOpacity 
                        onPress={() => {
                            setIsPasswordVisible(!isPasswordVisible);
                            setIsSecureText(!isSecureText);
                        }}>
                        <Icon 
                            name={isPasswordVisible ? 'visibility-off' : 'visibility'}
                            size={20} />
                    </TouchableOpacity>
                )}
            </View>
            <Text>{error} </Text>
        </View>

    );
};

const styles = StyleSheet.create(
    {
        input: {
            paddingVertical: 12,
            fontSize: 18,
            color: '#000'
        },
        inputError: {
            borderColor: 'red'
        },
        error: {
            color:'red',
        },
        inputContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 5,
            paddingHorizontal: 12,
            backgroundColor: '#f9f9f9ff'
        }
    }
)