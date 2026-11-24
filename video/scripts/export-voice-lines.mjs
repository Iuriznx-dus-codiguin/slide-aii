// Prints the narration lines from src/timeline.ts as JSON (id, text, max
// seconds) for scripts/make-voice.py.
//
//   node scripts/export-voice-lines.mjs > /tmp/lines.json

import { FPS, VOICE_LINES } from "../src/timeline.ts";

const lines = VOICE_LINES.map((l) => ({ id: l.id, text: l.text, max: +(l.max / FPS).toFixed(3) }));
process.stdout.write(JSON.stringify(lines, null, 2) + "\n");
