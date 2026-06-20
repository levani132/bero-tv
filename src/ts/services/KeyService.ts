// Central remote key map. Normalizes Tizen/Android/browser keyCodes into logical
// keys so pages/components handle intent, not raw codes (ui-ux-plan §7, FR-005).
export type LogicalKey =
  | "UP" | "DOWN" | "LEFT" | "RIGHT" | "OK" | "BACK"
  | "PLAYPAUSE" | "REWIND" | "FORWARD" | "DIGIT" | "UNKNOWN";

const MAP: Record<number, LogicalKey> = {
  37: "LEFT", 38: "UP", 39: "RIGHT", 40: "DOWN",
  13: "OK",
  8: "BACK", 461: "BACK" /* Android */, 10009: "BACK" /* Tizen RETURN */,
  415: "PLAYPAUSE", 19: "PLAYPAUSE", 10252: "PLAYPAUSE" /* Tizen */,
  412: "REWIND", 417: "FORWARD",
};

export function resolveKey(e: KeyboardEvent): LogicalKey {
  const code = e.keyCode;
  if (code >= 48 && code <= 57) return "DIGIT"; // 0-9 top row
  if (code >= 96 && code <= 105) return "DIGIT"; // numpad
  return MAP[code] || "UNKNOWN";
}

export function digitOf(e: KeyboardEvent): string {
  const code = e.keyCode;
  if (code >= 48 && code <= 57) return String(code - 48);
  if (code >= 96 && code <= 105) return String(code - 96);
  return "";
}
