import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlexWidget, TextWidget, requestWidgetUpdate } from 'react-native-android-widget';
import { widgetModel } from './model';

// The home-screen widget: Now and Next without opening the app.
// Docs: https://saleksovski.github.io/react-native-android-widget/
export const WIDGET_NAME = 'AlmanacNow';
const STORAGE_KEY = 'almanac:v2';

const PALETTE = {
  bg: '#12101F',
  ink: '#F4F0FF',
  muted: '#A9A3C7',
  accent: '#FF5C8A',
  chip: '#2A1F3D',
};

export function AlmanacWidget({ model }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ flex: 1, height: 'match_parent', width: 'match_parent', backgroundColor: PALETTE.bg, borderRadius: 18, padding: 14, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        <TextWidget text={model.kicker.toUpperCase()} style={{ fontSize: 11, color: PALETTE.accent, fontWeight: 'bold' }} />
        <TextWidget text={model.title} maxLines={2} style={{ fontSize: 18, color: PALETTE.ink, fontWeight: 'bold', marginTop: 4 }} />
        <TextWidget text={model.sub} maxLines={1} style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2 }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 10 }}>
        <Chip text={`${model.doneToday} done`} />
        <Chip text={`${model.openToday} open`} />
        {model.finish ? <Chip text={model.finish} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

function Chip({ text }) {
  return (
    <FlexWidget style={{ backgroundColor: PALETTE.chip, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 }}>
      <TextWidget text={text} style={{ fontSize: 11, color: PALETTE.ink }} />
    </FlexWidget>
  );
}

async function loadModel() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return widgetModel(raw ? JSON.parse(raw) : {}, Date.now());
  } catch (err) {
    return { kicker: 'Almanac', title: 'Open to plan the day', sub: '', doneToday: 0, openToday: 0, finish: null };
  }
}

// Runs headless when Android asks for the widget (added, resized, periodic
// update, tap). Reads the saved state; the app itself is not involved.
export async function widgetTaskHandler(props) {
  const { widgetAction, renderWidget } = props;
  if (widgetAction === 'WIDGET_DELETED') return;
  const model = await loadModel();
  renderWidget(<AlmanacWidget model={model} />);
}

// From inside the app: refresh the widget after the state changes.
let lastPush = 0;
export function refreshWidget(state) {
  if (Date.now() - lastPush < 30000) return;
  lastPush = Date.now();
  try {
    const model = widgetModel(state, Date.now());
    requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => <AlmanacWidget model={model} />, widgetNotFound: () => {} });
  } catch (err) {
    console.warn('Widget refresh failed', err?.message || err);
  }
}
