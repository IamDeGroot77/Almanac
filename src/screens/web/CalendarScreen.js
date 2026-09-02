import { Text } from 'react-native';
import { shared } from '../../theme';
import WebPage from './WebPage';

// Placeholder until the Google Calendar view lands (next commit).
export default function CalendarScreen() {
  return (
    <WebPage title="Calendar" subtitle="Month and week views of your Google Calendar, with tasks and assignments laid over.">
      <Text style={shared.muted}>Coming next: this tab reads and edits your Google Calendar directly.</Text>
    </WebPage>
  );
}
