import { useEffect, useRef } from 'react';
import * as QuickActions from 'expo-quick-actions';
import { isWeb } from './platform';

// Long-press the app icon: three shortcuts that skip the tabs.
// Docs: https://github.com/EvanBacon/expo-quick-actions
export const ACTIONS = [
  { id: 'ask', title: 'Tell Almanac', icon: 'shortcut_almanac', params: { go: 'ask' } },
  { id: 'one', title: 'Just one thing', icon: 'shortcut_almanac', params: { go: 'one' } },
  { id: 'hold', title: 'Hold a thought', icon: 'shortcut_almanac', params: { go: 'hold' } },
  { id: 'journal', title: 'Journal', icon: 'shortcut_almanac', params: { go: 'journal' } },
];

export default function useQuickActions(onAction) {
  const ref = useRef(onAction);
  ref.current = onAction;
  useEffect(() => {
    if (isWeb) return;
    let sub;
    try {
      QuickActions.setItems(ACTIONS);
      if (QuickActions.initial?.params?.go) setTimeout(() => ref.current?.(QuickActions.initial.params.go), 400);
      sub = QuickActions.addListener((action) => action?.params?.go && ref.current?.(action.params.go));
    } catch (err) {
      console.warn('Quick actions unavailable', err?.message || err);
    }
    return () => sub?.remove?.();
  }, []);
}
