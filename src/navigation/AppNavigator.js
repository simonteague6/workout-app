import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';

import StartScreen from '../screens/WorkoutTab/StartScreen.js';
import CalendarScreen from '../screens/HistoryTab/CalendarScreen.js';
import ProgressScreen from '../screens/ProgressTab/ProgressScreen.js';
import MoreScreen from '../screens/MoreTab/MoreScreen.js';

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
        options={{ title: 'Workout' }}
      />
    </Stack.Navigator>
  );
}

function HistoryStack() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'History' }}
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
        options={{ title: 'Progress' }}
      />
    </Stack.Navigator>
  );
}

function MoreStack() {
  const Stack = createNativeStackNavigator();
  return (
    <Stack.Navigator>
      <Stack.Screen name="More" component={MoreScreen} options={{ title: 'More' }} />
    </Stack.Navigator>
  );
}

// Lightweight text icons keep the scaffold dependency-free; real icons land
// with the tab UI work. Labels follow PRD §Navigation Structure.
function screenOptions({ route }) {
  return {
    tabBarIcon: ({ color, size }) => (
      <Text style={{ color, fontSize: size * 0.9, fontWeight: '600' }}>
        {route.name[0]}
      </Text>
    ),
    headerShown: false,
  };
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <BottomTab.Navigator screenOptions={screenOptions}>
        <BottomTab.Screen name="WorkoutTab" component={WorkoutStack} options={{ tabBarLabel: 'Workout' }} />
        <BottomTab.Screen name="HistoryTab" component={HistoryStack} options={{ tabBarLabel: 'History' }} />
        <BottomTab.Screen name="ProgressTab" component={ProgressStack} options={{ tabBarLabel: 'Progress' }} />
        <BottomTab.Screen name="MoreTab" component={MoreStack} options={{ tabBarLabel: 'More' }} />
      </BottomTab.Navigator>
    </NavigationContainer>
  );
}