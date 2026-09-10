import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from './src/context/AlertContext';
import { AuthProvider } from './src/context/AuthContext';
import { DocumentProvider } from './src/context/DocumentContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AlertProvider>
        <AuthProvider>
          <DocumentProvider>
            <AppNavigator />
          </DocumentProvider>
        </AuthProvider>
      </AlertProvider>
    </SafeAreaProvider>
  );
}
