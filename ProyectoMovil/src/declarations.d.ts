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
