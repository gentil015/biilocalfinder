module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['<rootDir>/tests/**/*.test.(ts|tsx)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-async-storage/.*|expo(nent)?|expo-.*|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|react-native-reanimated|react-native-worklets)/)',
  ],
};
