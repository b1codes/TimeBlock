import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChunkContainer } from './components/ChunkContainer';

const App = () => {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ChunkContainer />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
