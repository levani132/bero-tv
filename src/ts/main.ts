import { router } from "./lib/router";
import { Player } from "./pages/player";
import { Guide } from "./pages/guide";

window["exports"] = { __esModule: true };

if (window["Android"]) {
  window["backPressed"] = function () {
    router.goBack();
  };
}

window.onload = function () {
  setTimeout(function () {
    router.setup(document.body);
    router.registerRoute("player", Player);
    router.registerRoute("guide", Guide);
    router.goTo("player");
  }, 10);
};
