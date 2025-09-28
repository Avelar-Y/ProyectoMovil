declare module 'react-native-vector-icons/MaterialIcons' {
  import { ComponentType } from 'react';
  const Icon: ComponentType<any>;
  export default Icon;
}

declare module 'react-native-vector-icons/*' {
  import { ComponentType } from 'react';
  const Icon: ComponentType<any>;
  export default Icon;
}

// Minimal typings stub for react-native-keychain used until the package's types are installed
declare module 'react-native-keychain' {
  export function setGenericPassword(username: string, password: string, options?: any): Promise<boolean>;
  export function getGenericPassword(options?: any): Promise<{ username: string; password: string } | false>;
  export function resetGenericPassword(options?: any): Promise<boolean>;
  const Keychain: any;
  export default Keychain;
}

// Declaraciones para variables de entorno cargadas vía react-native-dotenv
declare module '@env' {
  export const GOOGLE_MAPS_API_KEY: string;
  export const APP_COMMISSION_PERCENT: string;
}
