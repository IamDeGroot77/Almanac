// A line for the morning. Starter set from well-loved shows; the user's own
// lines (Settings → Quotes, one per line as "quote — who, show") come first.

export const STARTER_QUOTES = [
  { text: 'A lesson without pain is meaningless. You cannot gain something without sacrificing something in return.', who: 'Edward Elric', show: 'Fullmetal Alchemist: Brotherhood' },
  { text: "If you don't take risks, you can't create a future.", who: 'Monkey D. Luffy', show: 'One Piece' },
  { text: "It's not the face that makes someone a monster; it's the choices they make.", who: 'Naruto Uzumaki', show: 'Naruto' },
  { text: 'Whether you win or lose, you can always come out ahead by learning from the experience.', who: 'Rock Lee', show: 'Naruto' },
  { text: 'Being the best decoy ever is as cool as being the ace.', who: 'Shoyo Hinata', show: 'Haikyu!!' },
  { text: 'The moment you think of giving up, think of the reason why you held on so long.', who: 'Natsu Dragneel', show: 'Fairy Tail' },
  { text: 'You should enjoy the little detours to the fullest. Because that is where you will find the things more important than what you want.', who: 'Ging Freecss', show: 'Hunter x Hunter' },
  { text: 'Go beyond. Plus ultra.', who: 'All Might', show: 'My Hero Academia' },
  { text: "If you can only do one thing, hone it to perfection. Hone it to the utmost limit.", who: 'Zenitsu Agatsuma', show: 'Demon Slayer' },
  { text: "Set your heart ablaze.", who: 'Kyojuro Rengoku', show: 'Demon Slayer' },
  { text: 'The world is cruel, but also very beautiful.', who: 'Mikasa Ackerman', show: 'Attack on Titan' },
  { text: "Power comes in response to a need, not a desire. You have to create that need.", who: 'Goku', show: 'Dragon Ball Z' },
  { text: 'Sometimes you must hurt in order to know, fall in order to grow, lose in order to gain.', who: 'Pain', show: 'Naruto Shippuden' },
  { text: "Push through the pain. Giving up hurts more.", who: 'Vegeta', show: 'Dragon Ball Z' },
  { text: "There's no such thing as a painless lesson. They just don't exist.", who: 'Edward Elric', show: 'Fullmetal Alchemist: Brotherhood' },
  { text: 'Fear is not evil. It tells you what your weakness is.', who: 'Gildarts Clive', show: 'Fairy Tail' },
];

// "quote — who, show" or "quote - who" or just "quote".
export function parseQuotes(text) {
  return (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s+[—–-]\s+(.+)$/);
      if (!m) return { text: line.replace(/^["“]|["”]$/g, ''), who: null, show: null };
      const [who, ...rest] = m[2].split(',').map((s) => s.trim());
      return { text: m[1].replace(/^["“]|["”]$/g, ''), who: who || null, show: rest.join(', ') || null };
    });
}

export function quoteOfDay(key, own = []) {
  const pool = own.length ? [...own, ...STARTER_QUOTES] : STARTER_QUOTES;
  let h = 0;
  for (const ch of key || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // The user's own lines come up three times as often.
  const weighted = own.length ? [...own, ...own, ...pool] : pool;
  return weighted[h % weighted.length];
}
