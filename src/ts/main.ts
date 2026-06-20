import { router } from "./lib/router";
import { Player } from "./pages/player";
import { Guide } from "./pages/guide";

window["exports"] = { __esModule: true };

if (window["Android"]) {
  window["backPressed"] = function () {
    router.goBack();
  };
}

// Tizen does NOT deliver hardware remote keys (Channel Up/Down, Channel List,
// media keys) to a web app unless they are registered via tvinputdevice. Arrows,
// OK and Return are always delivered and must NOT be registered. Requires the
// tv.inputdevice privilege in config.xml.
function registerTizenKeys() {
  if (!window["tizen"] || !tizen.tvinputdevice) return;
  var keys = [
    "ChannelUp", "ChannelDown", "ChannelList",
    "MediaPlayPause", "MediaPlay", "MediaPause",
    "MediaRewind", "MediaFastForward",
  ];
  for (var i = 0; i < keys.length; i++) {
    try {
      tizen.tvinputdevice.registerKey(keys[i]);
    } catch (e) {
      /* key not supported on this model — ignore */
    }
  }
}

window.onload = function () {
  setTimeout(function () {
    registerTizenKeys();
    router.setup(document.body);
    router.registerRoute("player", Player);
    router.registerRoute("guide", Guide);
    router.goTo("player");
  }, 10);
};
