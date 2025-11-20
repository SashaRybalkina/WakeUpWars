/**
 * @file _layout.tsx
 * @description Handles root layout of the app.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { UserProvider } from './context/UserContext';
import { AppProvider } from '../providers/AppProvider';
import { Alarm } from './Alarm'; // Import the Alarm class


export default function RootLayout() {
  // Simulate fetching alarm data from a "database"
  const fetchDummyAlarms = async () => {
    return [
      {
        hour: 3,
        minute: 15,
        screen: 'SudokuScreen',
        params: { puzzleId: 42 },
      },
      {
        hour: 7,
        minute: 45,
        screen: 'MeditationScreen',
        params: { session: 'morning' },
      },
    ];
  };

  useEffect(() => {
    const setupAlarms = async () => {
      const alarmList = await fetchDummyAlarms();

      try {
        // Request notification permission once for all alarms
        await Alarm.requestPermissions();
      } catch (err) {
      }
    };

    // Run on first load
    setupAlarms();

    // Reschedule on app resume
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setupAlarms(); // Reschedule alarms when app comes to the foreground
      }
    });

    return () => sub.remove();
  }, []);
}
