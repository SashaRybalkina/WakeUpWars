import { Slot, SplashScreen } from 'expo-router';
import { UserProvider } from './context/UserContext';

import { AppProvider } from '../providers/AppProvider';
import Chat from './Chat.js';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProvider onInitialized={() => SplashScreen.hideAsync()}>
      <UserProvider> {}
        <Slot />
      </UserProvider>
    </AppProvider>
  );
}
