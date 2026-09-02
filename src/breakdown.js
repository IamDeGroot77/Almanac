import { dayKey, parseDayKey } from './dates.js';
import { almanacToday } from './clock.js';

// "Break it down": starter steps for a task, chosen by what the task sounds
// like. The point is a first step small enough to actually start; the user
// edits from there. Canvas assignments with a deadline get their steps
// spread back from the due date (backward planning).

const TEMPLATES = [
  {
    match: /\b(essay|paper|report|write|writing|draft|article|blog|memo|proposal|thesis|reflection)\b/i,
    steps: ['Open the doc and write the title', 'Outline: three bullet points', 'Rough draft, no editing', 'Revise', 'Proofread and submit'],
  },
  {
    match: /\b(problem set|homework|hw|exercises|worksheet|quiz|exam|test|study|review)\b/i,
    steps: ['Open the material and read the instructions', 'Do the first problem', 'Work through the rest', 'Check answers', 'Redo the ones you missed'],
  },
  {
    match: /\b(read|reading|chapter|pages|textbook|article)\b/i,
    steps: ['Skim the headings', 'Read the first section', 'Read the rest', 'Three-line notes on what mattered'],
  },
  {
    match: /\b(discussion|post|reply|forum|respond)\b/i,
    steps: ['Read the prompt', 'Two-sentence answer', 'Expand to a full post', 'Reply to one classmate'],
  },
  {
    match: /\b(presentation|slides|deck|present)\b/i,
    steps: ['Write the one-line point', 'List the slides on paper', 'Build the slides', 'Run through it once out loud'],
  },
  {
    match: /\b(clean|tidy|organize|declutter|laundry|dishes|kitchen|garage|room|closet)\b/i,
    steps: ['Set a 10-minute timer', 'Clear the surfaces', 'Sort into keep, move, toss', 'Put things away', 'Wipe down'],
  },
  {
    match: /\b(buy|shop|grocer|errand|pick up|return|store)\b/i,
    steps: ['Write the list', 'Go', 'Buy it', 'Put it away'],
  },
  {
    match: /\b(email|call|phone|message|contact|schedule|book|appointment|apply|form|sign up|register)\b/i,
    steps: ['Find the contact or link', 'Write the two sentences you need', 'Send it or make the call', 'Note what they said'],
  },
  {
    match: /\b(fix|repair|install|set up|setup|build|assemble)\b/i,
    steps: ['Get the tools and parts out', 'Do the first step of the instructions', 'Keep going', 'Test it', 'Put the tools away'],
  },
];

const GENERIC = ['Get set up (open what you need)', 'First 10 minutes', 'The middle part', 'Finish and check it over'];

export function suggestSteps(text) {
  const t = text || '';
  for (const tpl of TEMPLATES) if (tpl.match.test(t)) return [...tpl.steps];
  return [...GENERIC];
}

// Spread step due dates from today to the deadline, last step on the deadline.
// Returns an array of day keys (or nulls when there's no room).
export function planDates(stepCount, dueKey, today = almanacToday()) {
  if (!dueKey || dueKey <= today || stepCount === 0) return new Array(stepCount).fill(null);
  const start = parseDayKey(today);
  const end = parseDayKey(dueKey);
  const spanDays = Math.round((end - start) / 86400000);
  if (spanDays < stepCount) {
    // Not enough days for one per step: everything but the last goes on the last usable days.
    return Array.from({ length: stepCount }, (_, i) => {
      const d = new Date(end);
      d.setDate(d.getDate() - Math.max(0, stepCount - 1 - i));
      return d < start ? null : dayKey(d);
    });
  }
  return Array.from({ length: stepCount }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + Math.round(((i + 1) / stepCount) * spanDays));
    return dayKey(d);
  });
}
