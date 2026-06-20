// Bridge an event-handler reference into an inline-HTML attribute by registering
// a uniquely-named global function (mirrors bero-movies' renderer).
let functionIndex = 0;

export function handler(f: Function, ...args: any[]) {
  const name = "f" + functionIndex++;
  window[name] = function () {
    f.apply(null, args);
  };
  return name + "()";
}

// Escape user/EPG-provided text before inlining into HTML strings.
export function esc(text: any): string {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
