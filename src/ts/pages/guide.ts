import { router } from "../lib/router";
import { resolveKey } from "../services/KeyService";
import { t } from "../lib/i18n";

// Full grid guide (FR-011) — secondary surface. Stub for now; the grid is built in
// User Story 3 / a later increment. The per-channel timeline (also US3) is the
// primary catch-up entry point.
export function Guide() {
  function onKey(e: KeyboardEvent) {
    if (resolveKey(e) === "BACK") router.goBack();
  }
  // @ts-ignore
  Guide.mount = function () {
    document.addEventListener("keydown", onKey);
  };
  // @ts-ignore
  Guide.destructor = function () {
    document.removeEventListener("keydown", onKey);
  };
  return '<div class="state"><div class="state__msg">' + t("loading") + "</div></div>";
}
