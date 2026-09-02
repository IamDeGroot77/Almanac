// Apps Almanac can hand off to at the right moment, e.g. a focus timer when
// you start a task that doesn't need the phone. Package names must also be
// listed in app.config.js (Android package visibility).
export const APP_CATALOG = [
  {
    id: 'focusFriend',
    name: 'Focus Friend',
    package: 'com.underthing.focus.friend',
    kind: 'focus',
    blurb: 'A cozy focus timer. Put the phone down and let the bean knit.',
  },
  {
    id: 'forest',
    name: 'Forest',
    package: 'cc.forestapp',
    kind: 'focus',
    blurb: 'Grow a tree while you stay off the phone.',
  },
  {
    id: 'googleClock',
    name: 'Clock',
    package: 'com.google.android.deskclock',
    kind: 'timer',
    blurb: 'A plain countdown timer.',
  },
  {
    id: 'samsungClock',
    name: 'Samsung Clock',
    package: 'com.sec.android.app.clockpackage',
    kind: 'timer',
    blurb: 'A plain countdown timer.',
  },
];

