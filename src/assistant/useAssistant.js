import { useCallback, useEffect, useRef, useState } from 'react';
import { getSecret, setSecret, deleteSecret } from '../secure';
import { buildSnapshot } from './snapshot';
import { resolveCalls, applyAction } from './tools';
import { askClaude, MODELS } from './client';
import { parseQuickTask } from '../quickParse';
import { almanacToday } from '../clock';
import { describeDayKey } from '../dates';

// One box to say things into. With a key, Claude files the line with tools
// and the app applies them. Without a key, or when the call fails, the line
// is never lost: it becomes a task (when it parses as one) or a held thought.

export const API_KEY_SECRET = 'anthropicApiKey';

export default function useAssistant(store, { model = 'quick' } = {}) {
  const [hasKey, setHasKey] = useState(null); // null until read
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null); // { text, lines, errors, undo, at, fallback }
  const keyRef = useRef(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    getSecret(API_KEY_SECRET)
      .then((k) => {
        keyRef.current = k || null;
        setHasKey(!!k);
      })
      .catch(() => setHasKey(false));
  }, []);

  const saveKey = useCallback(async (k) => {
    const v = (k || '').trim();
    if (v) await setSecret(API_KEY_SECRET, v);
    else await deleteSecret(API_KEY_SECRET);
    keyRef.current = v || null;
    setHasKey(!!v);
  }, []);

  // Without the model: the quick parser for "milk to groceries tomorrow",
  // else working memory. The line is kept either way.
  const fallback = useCallback((text, reason) => {
    const s = storeRef.current;
    const parsed = parseQuickTask(text, { lists: s.lists, people: s.people });
    const looksLikeTask = parsed.listId || parsed.due || /^(call|email|text|buy|get|send|pay|book|fix|clean|write|read|finish|start|pick up|drop off|schedule|make|order|return|sign|print|submit)\b/i.test(parsed.text || '');
    if (looksLikeTask && parsed.text) {
      // "tomorrow" or "Friday" without a list means that day's list.
      const listId = parsed.listId || `day:${parsed.due || almanacToday()}`;
      const id = s.addTask(parsed.text, listId, parsed.personId);
      if (parsed.due && id) s.setTaskDue(id, parsed.due, null);
      const where = parsed.listId ? (s.lists.find((l) => l.id === parsed.listId)?.name || 'a list') : parsed.due ? describeDayKey(parsed.due) : 'today';
      return { text: reason, lines: [`Added "${parsed.text}" to ${where}.`], errors: [], undo: id ? () => s.deleteTask(id) : null, at: Date.now(), fallback: true };
    }
    s.addScratch(text, 'typed');
    return { text: reason, lines: ['Held in working memory.'], errors: [], undo: null, at: Date.now(), fallback: true };
  }, []);

  const ask = useCallback(
    async (text) => {
      const line = (text || '').trim();
      if (!line) return null;
      const s = storeRef.current;
      if (!keyRef.current) {
        const r = fallback(line, 'No assistant key yet. Filed the plain way.');
        setLast(r);
        return r;
      }
      setBusy(true);
      try {
        const snapshot = buildSnapshot(s, Date.now());
        const reply = await askClaude({ apiKey: keyRef.current, model: MODELS[model]?.id || MODELS.quick.id, snapshot, text: line });
        const resolved = resolveCalls(s, reply.calls, Date.now());
        const undos = [];
        const lines = [];
        const errors = [];
        for (const r of resolved) {
          if (!r.ok) {
            errors.push(r.error);
            continue;
          }
          try {
            const undo = applyAction(storeRef.current, r.action);
            if (undo) undos.push(undo);
            lines.push(r.line);
          } catch (err) {
            errors.push(`${r.call.name} failed: ${err?.message || err}`);
          }
        }
        // The model said something but filed nothing: keep the line anyway,
        // unless it was a question about the day (an answer is the result).
        if (!reply.calls.length && !reply.text) {
          const r = fallback(line, 'Nothing came back. Filed the plain way.');
          setLast(r);
          return r;
        }
        const result = { text: reply.text, lines, errors, undo: undos.length ? () => undos.reverse().forEach((u) => u()) : null, at: Date.now(), fallback: false, usage: reply.usage };
        setLast(result);
        return result;
      } catch (err) {
        const r = fallback(line, `${err?.message || 'The assistant did not answer.'} Filed the plain way.`);
        setLast(r);
        return r;
      } finally {
        setBusy(false);
      }
    },
    [fallback, model]
  );

  return { hasKey, busy, last, ask, saveKey, clearLast: () => setLast(null) };
}
