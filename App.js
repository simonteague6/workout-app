import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import AppNavigator from './src/navigation/AppNavigator.js';
import { initDatabase } from './src/utils/db.js';
import { seedExercises } from './src/db/seed/seed.js';

// Opens the database, runs pending migrations, and seeds the exercise library
// on first launch. The live workout session and other stores read from the
// shared DB via getDatabase() once this resolves.
async function bootstrap() {
  const db = initDatabase();
  seedExercises(db);
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    bootstrap()
      .catch((err) => {
        // Surface boot errors to the console; the app still mounts so the UI
        // is visible for debugging. Store/query actions will fail loudly.
        console.error('Database bootstrap failed:', err);
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});