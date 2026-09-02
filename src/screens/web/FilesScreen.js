import { Text } from 'react-native';
import { shared } from '../../theme';
import WebPage from './WebPage';

// Placeholder until the Drive drop box lands.
export default function FilesScreen() {
  return (
    <WebPage title="Files" subtitle="A drop box between laptop and phone, kept in a folder Drive makes for Almanac.">
      <Text style={shared.muted}>Coming next: drag files here and pick them up on the phone, and the reverse.</Text>
    </WebPage>
  );
}
