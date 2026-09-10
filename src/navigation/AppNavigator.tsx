import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types/navigation';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ScannerScreen } from '../screens/scanner/ScannerScreen';
import { DocumentReviewScreen } from '../screens/review/DocumentReviewScreen';
import { CombineFilesScreen } from '../screens/tools/CombineFilesScreen';
import { CompressPdfScreen } from '../screens/tools/CompressPdfScreen';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/colors';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isInitialized, isAuthenticated, isGuest } = useAuth();

  if (!isInitialized) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName={isAuthenticated || isGuest ? 'MainTabs' : 'Login'}
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <RootStack.Screen name="Login" component={LoginScreen} />
        <RootStack.Screen name="MainTabs" component={HomeScreen} />
        <RootStack.Screen
          name="ScannerModal"
          component={ScannerScreen}
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <RootStack.Screen
          name="DocumentReview"
          component={DocumentReviewScreen}
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <RootStack.Screen
          name="CombineFiles"
          component={CombineFilesScreen}
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <RootStack.Screen
          name="CompressPdf"
          component={CompressPdfScreen}
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

