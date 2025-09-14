module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-navigation|react-native-vector-icons)/)"
  ],
  moduleNameMapper: {
    "^@react-native-firebase/(.*)$": "<rootDir>/__mocks__/reactNativeFirebaseMock.js",
    "^@react-navigation/native$": "<rootDir>/__mocks__/reactNavigationNativeMock.js"
  },
};
