import { useEffect, useRef } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated, Easing, Text, View } from 'react-native';

import StartScreen from '../screens/WorkoutTab/StartScreen.js';
import LiveSession from '../screens/WorkoutTab/LiveSession.js';
import FinishScreen from '../screens/WorkoutTab/FinishScreen.js';
import RoutineBuilderScreen from '../screens/WorkoutTab/RoutineBuilderScreen.js';
import RoutinePreviewScreen from '../screens/WorkoutTab/RoutinePreviewScreen.js';
import CalendarScreen from '../screens/HistoryTab/CalendarScreen.js';
import ProgressScreen from '../screens/ProgressTab/ProgressScreen.js';
import MoreScreen from '../screens/MoreTab/MoreScreen.js';
import ExerciseLibraryScreen from '../screens/MoreTab/ExerciseLibraryScreen.js';
import ExerciseDetailScreen from '../screens/MoreTab/ExerciseDetailScreen.js';
import ExerciseEditorScreen from '../screens/MoreTab/ExerciseEditorScreen.js';
import ExerciseHistoryScreen from '../screens/HistoryTab/ExerciseHistoryScreen.js';
import SessionDetail from '../screens/HistoryTab/SessionDetail.js';
import AppearanceSettings from '../screens/MoreTab/AppearanceSettings.js';
import AISettings from '../screens/MoreTab/AISettings.js';
import ImportRoutineScreen from '../screens/MoreTab/ImportRoutineScreen.js';
import ImportReviewScreen from '../screens/MoreTab/ImportReviewScreen.js';
import OnboardingScreen from '../screens/MoreTab/OnboardingScreen.js';
import DataScreen from '../screens/MoreTab/DataScreen.js';
import { useAppTheme } from '../theme/index.js';
import { useWorkoutStore } from '../stores/workoutStore.js';
import Icon from '../components/Icon.js';

const BottomTab = createBottomTabNavigator();

// Each tab gets its own stack so later issues can push detail screens while
// preserving tab state (e.g. LiveSession in Workout, SessionDetail in History).
function WorkoutStack() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Start"
        component={StartScreen}
        options={{ title: 'Workout', headerShown: false }}
      />
      <Stack.Screen
        name="LiveSession"
        component={LiveSession}
        options={{ title: 'Workout', headerShown: false }}
      />
      <Stack.Screen
        name="Finish"
        component={FinishScreen}
        options={{ title: 'Workout complete', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="RoutineBuilder"
        component={RoutineBuilderScreen}
        options={({ route }) => ({ title: route.params?.routineId ? 'Edit routine' : 'New routine' })}
      />
      <Stack.Screen
        name="RoutinePreview"
        component={RoutinePreviewScreen}
        options={{ title: 'Routine' }}
      />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: 'Exercise' }} />
      <Stack.Screen
        name="ExerciseEditor"
        component={ExerciseEditorScreen}
        options={({ route }) => ({ title: route.params?.exerciseId ? 'Edit exercise' : 'New exercise' })}
      />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator>
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'History', headerShown: false }} />
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} options={{ title: 'Exercise Library' }} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: 'Exercise' }} />
      <Stack.Screen
        name="ExerciseEditor"
        component={ExerciseEditorScreen}
        options={({ route }) => ({ title: route.params?.exerciseId ? 'Edit exercise' : 'New exercise' })}
      />
      <Stack.Screen
        name="ExerciseHistory"
        component={ExerciseHistoryScreen}
        options={({ route }) => ({ title: route.params?.exerciseName ?? 'Exercise history' })}
      />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetail}
        options={{ title: 'Session' }}
      />
    </Stack.Navigator>
  );
}

function ProgressStack() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: 'Progress', headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function MoreStack() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator>
      <Stack.Screen name="More" component={MoreScreen} options={{ title: 'More', headerShown: false }} />
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} options={{ title: 'Exercise Library' }} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: 'Exercise' }} />
      <Stack.Screen
        name="ExerciseEditor"
        component={ExerciseEditorScreen}
        options={({ route }) => ({ title: route.params?.exerciseId ? 'Edit exercise' : 'New exercise' })}
      />
      <Stack.Screen
        name="ExerciseHistory"
        component={ExerciseHistoryScreen}
        options={({ route }) => ({ title: route.params?.exerciseName ?? 'Exercise history' })}
      />
      <Stack.Screen name="ImportRoutine" component={ImportRoutineScreen} options={{ title: 'Import routine' }} />
      <Stack.Screen name="ImportReview" component={ImportReviewScreen} options={{ title: 'Review import' }} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Welcome', headerShown: false }} />
      <Stack.Screen name="Appearance" component={AppearanceSettings} options={{ title: 'Appearance' }} />
      <Stack.Screen name="AISettings" component={AISettings} options={{ title: 'AI & API Keys' }} />
      <Stack.Screen name="Data" component={DataScreen} options={{ title: 'Data' }} />
    </Stack.Navigator>
  );
}

// Tab icons: Workout uses a lucide dumbbell with a pulsing green dot when a
// rest timer is running (visible from any tab). The other tabs keep their
// lightweight letter glyphs until the tab-UI fan-out.
function RestBadge() {
  // Pulsing dot: scale + opacity loop so the timer is glanceable.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.out(Easing.exp), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.in(Easing.exp), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -2,
        right: -4,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#1CE882',
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

function WorkoutTabIcon({ color, size, focused }) {
  const endsAt = useWorkoutStore((s) => s.restTimerEndsAt);
  return (
    <View>
      <Icon name="dumbbell" size={size} color={color} strokeWidth={focused ? 2.4 : 2} />
      {endsAt != null ? <RestBadge /> : null}
    </View>
  );
}

function screenOptions({ route }) {
  const isWorkout = route.name === 'WorkoutTab';
  return {
    tabBarIcon: isWorkout
      ? ({ color, size, focused }) => <WorkoutTabIcon color={color} size={size} focused={focused} />
      : ({ color, size }) => (
          <Text style={{ color, fontSize: size * 0.9, fontWeight: '600' }}>
            {route.name[0]}
          </Text>
        ),
    headerShown: false,
  };
}

export default function AppNavigator() {
  const { resolved, colors } = useAppTheme();
  const base = resolved === 'dark' ? DarkTheme : DefaultTheme;
  // Tint React Navigation's theme with our palette so the nav chrome (tab
  // bar + stack headers) follows the user's theme preference.
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.accent,
    },
  };
  return (
    <NavigationContainer theme={theme}>
      <BottomTab.Navigator screenOptions={screenOptions}>
        <BottomTab.Screen name="WorkoutTab" component={WorkoutStack} options={{ tabBarLabel: 'Workout' }} />
        <BottomTab.Screen name="HistoryTab" component={HistoryStack} options={{ tabBarLabel: 'History' }} />
        <BottomTab.Screen name="ProgressTab" component={ProgressStack} options={{ tabBarLabel: 'Progress' }} />
        <BottomTab.Screen name="MoreTab" component={MoreStack} options={{ tabBarLabel: 'More' }} />
      </BottomTab.Navigator>
    </NavigationContainer>
  );
}