import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Button, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import * as Calendar from 'expo-calendar/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import * as Notifications from 'expo-notifications';
// NOTE: Notifications disabled until we're running the EAS dev build.
// Expo Go removed notification support in SDK 53.

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowBanner: true,
//     shouldShowList: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

export default function App() {
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [input, setInput] = useState("");

  // Fetch today's calendar events on startup
  useEffect(() => {
    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') return;

      const calendars = await Calendar.getCalendarsAsync();
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const todaysEvents = await Calendar.getEventsAsync(
        calendars.map(c => c.id), start, end
      );
      setEvents(todaysEvents.map(ev => ({
        id: ev.id,
        title: ev.title,
        time: new Date(ev.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      })));
    })();
  }, []);

  // Set up the daily 6:30 AM notification — DISABLED until EAS dev build
  // useEffect(() => {
  //   (async () => {
  //     const { status } = await Notifications.requestPermissionsAsync();
  //     if (status !== 'granted') return;
  //
  //     await Notifications.cancelAllScheduledNotificationsAsync();
  //
  //     await Notifications.scheduleNotificationAsync({
  //       content: {
  //         title: "Your Almanac",
  //         body: "Your day is ready. Tap to see today's events and tasks.",
  //       },
  //       trigger: {
  //         type: Notifications.SchedulableTriggerInputTypes.DAILY,
  //         hour: 6,
  //         minute: 30,
  //       },
  //     });
  //   })();
  // }, []);

  // Load saved tasks on startup
  useEffect(() => {
    AsyncStorage.getItem('tasks').then(saved => {
      if (saved) setTasks(JSON.parse(saved));
    });
  }, []);

  // Auto-save tasks whenever they change
  useEffect(() => {
    AsyncStorage.setItem('tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    if (!input.trim()) return;
    setTasks([...tasks, { id: Date.now().toString(), text: input.trim(), done: false }]);
    setInput("");
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>The Almanac Begins!!!</Text>

      {events.map(e => <Text key={e.id}>{e.time} — {e.title}</Text>)}

      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder="Add a task..."
        onSubmitEditing={addTask}
      />
      <Button title="Add" onPress={addTask} />

      {tasks.map(t => (
        <TouchableOpacity key={t.id} onPress={() => toggleTask(t.id)}>
          <Text style={t.done ? styles.taskDone : styles.task}>
            {t.done ? "✓ " : "• "}{t.text}
          </Text>
        </TouchableOpacity>
      ))}

      <StatusBar style="auto"/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    width: '80%',
    marginTop: 20,
  },
  task: { fontSize: 16, marginTop: 8 },
  taskDone: { fontSize: 16, marginTop: 8, textDecorationLine: 'line-through', color: '#999' },
});