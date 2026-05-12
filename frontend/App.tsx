import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { OpenSans_300Light, OpenSans_400Regular } from '@expo-google-fonts/open-sans';

import { RootStackParamList } from './src/navigation/types';
import { ChunkListScreen } from './src/screens/ChunkListScreen';
import { ChunkEditorScreen } from './src/screens/ChunkEditorScreen';
import { theme } from './src/styles/theme';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  const [fontsLoaded, fontError] = useFonts({
    'Montserrat-Bold': Montserrat_700Bold,
    'OpenSans-Light': OpenSans_300Light,
    'OpenSans-Regular': OpenSans_400Regular,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider onLayout={onLayoutRootView}>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="ChunkList"
            screenOptions={{
              headerStyle: {
                backgroundColor: theme.colors.background,
              },
              headerTintColor: theme.colors.text,
              headerTitleStyle: {
                fontFamily: 'Montserrat-Bold',
              },
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen 
              name="ChunkList" 
              component={ChunkListScreen} 
              options={{ title: 'CHRONOS' }}
            />
            <Stack.Screen 
              name="ChunkEditor" 
              component={ChunkEditorScreen} 
              options={({ route }) => ({ title: route.params.chunk.title.toUpperCase() })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
