module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        // Añadimos ambas claves por compatibilidad entre versiones del plugin
        allowlist: ['GOOGLE_MAPS_API_KEY', 'APP_COMMISSION_PERCENT'],
        whitelist: ['GOOGLE_MAPS_API_KEY', 'APP_COMMISSION_PERCENT'],
        safe: false,
        allowUndefined: false,
      },
    ],
  ],
};
