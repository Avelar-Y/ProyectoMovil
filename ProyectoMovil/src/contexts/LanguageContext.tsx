import { I18n } from "i18n-js";
import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { translations } from "../translations/i18n";

type Language = "es" | "en" | "fr";

const i18n = new I18n(translations);
i18n.defaultLocale = "fr";
i18n.enableFallback = true;

const LanguageContext = createContext<{
language: Language,
changeLanguage: (lng: Language) => void,
}| null> (null);

export const LanguageProvider = ({children}: {children: React.ReactNode})=> {
    const [language, setLanguage] = useState<Language>("es");

    useEffect(()=>{
        const loadLanguage = async () => {
            const storedLanguage = await AsyncStorage.getItem("language");
            if (storedLanguage) {
                setLanguage(storedLanguage as Language);
                i18n.locale  = storedLanguage;
            }else if(!i18n.locale) {
                setLanguage(i18n.defaultLocale as Language);
                i18n.locale = i18n.defaultLocale;
            }
        }
        loadLanguage();
    },[])

    const changeLanguage = async (lang: Language) => {
        setLanguage(lang);
        i18n.locale = lang;
        await AsyncStorage.setItem("language", lang);
    }; 

    return (
        <LanguageContext.Provider value={{language, changeLanguage}}>
            {children}
        </LanguageContext.Provider>
    )
}

export const useLanguage = () => {
    const context = useContext(LanguageContext);
     if (!context) throw new Error("useLanguage debe usarse dentro de LanguageProvider");
    return context;
}

export {i18n}