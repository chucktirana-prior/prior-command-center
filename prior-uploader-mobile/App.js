import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StartScreen from './screens/StartScreen';
import ReviewScreen from './screens/ReviewScreen';
import ConfirmationScreen from './screens/ConfirmationScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Start"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700', letterSpacing: 2 },
        }}
      >
        <Stack.Screen name="Start" component={StartScreen} options={{ title: 'PRIOR' }} />
        <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review & Edit' }} />
        <Stack.Screen
          name="Confirmation"
          component={ConfirmationScreen}
          options={{ title: 'Draft Created', headerBackVisible: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
