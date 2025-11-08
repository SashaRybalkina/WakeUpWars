import 'react-native-gesture-handler';
import React from 'react';
import { registerRootComponent } from 'expo';

import { AppProvider } from './src/providers/AppProvider';
import { GroupsProvider } from "./src/app/context/GroupsContext";
import { UserProvider } from './src/app/context/UserContext';
import App from './src/app';

function Root() {
  return (
    <AppProvider onInitialized={() => {}}>
      <UserProvider>
        <GroupsProvider>
          <App />
        </GroupsProvider>
      </UserProvider>
    </AppProvider>
  );
}

registerRootComponent(Root);
