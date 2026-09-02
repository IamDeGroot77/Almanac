// A syllabus pasted as markdown. Run: node scripts/test-import-school.mjs
import assert from 'node:assert/strict';
import { parseImport } from '../src/importText.js';

const text = `School (in Work):
# Fall 2026 — Weekly Tasks

## Week 1 — 9/9–9/15

**MPA 711**
- [ ] Read Ch. 1, "What Public Administration Entails"
- [ ] Discussion Topic 1: What PA Entails — post Sat 9/12, replies Tue 9/15

**MPA 752 — Course 1**
- [ ] Read Bland Ch. 1
- [ ] Course 1 discussion (lecture + readings boards) — Fri 9/11

## Week 2 — 9/16–9/22

**MPA 752 — Course 2**
- [ ] **Assignment One — Article Discussion (2–3 pages) — Sat 9/19**

**MPA 752 — Course 3** (opens 9/28)
- [ ] Read Bland Ch. 10

## Week 7 — 10/21–10/27

- [ ] **MPA 752 — Final Budget Assignment (15–25 pages) — Mon 10/26**
`;

const plan = parseImport(text, { people: [], lists: [], now: new Date(2026, 8, 2) });
assert.equal(plan.lists.length, 1);
const school = plan.lists[0];
assert.equal(school.name, 'School');
assert.equal(school.categoryName, 'Work');
const t = school.tasks;
assert.equal(t.length, 7);

// Week end is the default due date; course comes from the bold line.
assert.equal(t[0].text, 'Read Ch. 1, "What Public Administration Entails"');
assert.equal(t[0].course, 'MPA 711');
assert.equal(t[0].due, '2026-09-15');
assert.equal(t[0].week.n, 1);

// Explicit timing wins and is kept in the notes.
assert.equal(t[1].due, '2026-09-12');
assert.match(t[1].notes, /post Sat 9\/12, replies Tue 9\/15/);
assert.equal(t[3].due, '2026-09-11');
assert.equal(t[3].course, 'MPA 752');

// Bold assignment: bold stripped, date parsed, course stripped from the label when repeated.
assert.equal(t[4].text, 'Assignment One — Article Discussion (2–3 pages)');
assert.equal(t[4].due, '2026-09-19');
assert.equal(t[5].course, 'MPA 752');
assert.equal(t[5].due, '2026-09-22', '"(opens 9/28)" on the course line does not become a date');

// No course line in week 7: the course is in the item text and stays there.
assert.equal(t[6].text, 'MPA 752 — Final Budget Assignment (15–25 pages)');
assert.equal(t[6].due, '2026-10-26');

console.log('All syllabus import scenarios passed.');
