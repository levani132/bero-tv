// i18n-ready string layer (FR-003). v1 ships Georgian (ka) only; no hard-coded
// UI text elsewhere. Adding English later = adding a table + a language switch.
import { DEFAULT_LANG } from "../models/config";

type StringTable = Record<string, string>;

const ka: StringTable = {
  "app.name": "Bero TV",
  "loading": "იტვირთება…",
  "retry": "თავიდან ცდა",
  "error.network": "ქსელის შეცდომა. შეამოწმეთ კავშირი.",
  "error.guest": "წვდომის მიღება ვერ მოხერხდა.",
  "error.stream": "არხის ჩვენება ვერ ხერხდება.",
  "error.geo": "ეს არხი მიუწვდომელია თქვენს რეგიონში.",
  "epg.none": "გადაცემის ინფორმაცია არ არის",
  "live": "პირდაპირი ეთერი",
  "behindLive": "ჩამორჩენა",
  "catchup.unavailable": "ამ არხზე გადახვევა შეუძლებელია",
  "search": "ძიება",
  "category": "კატეგორია",
};

const tables: Record<string, StringTable> = { ka };

let current = DEFAULT_LANG;

export function setLanguage(lang: string) {
  if (tables[lang]) current = lang;
}

export function t(key: string): string {
  const table = tables[current] || ka;
  return table[key] || key;
}
