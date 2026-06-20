const { src, series, dest, watch } = require("gulp");
const ts = require("gulp-typescript");
const gls = require("gulp-live-server");
const inject = require("gulp-inject-string");

const tsProject = ts.createProject("tsconfig.json");

function build() {
  return src("src/ts/**/*.ts").pipe(tsProject()).pipe(dest("dist/js"));
}

function copyCss() {
  return src("src/css/**/*").pipe(dest("dist/css"));
}

function copyImages() {
  return src("src/images/**/*").pipe(dest("dist/images"));
}

// Production URL the packaged Tizen .wgt loads its app code/assets from.
// MUST match the deployed Vercel URL (mirrors bero-movies' base-href approach).
const TIZEN_BASE = "https://bero-tv.vercel.app/";

function copyTizenHtml() {
  // The Tizen package is a thin shell: it injects a <base href> so the webview
  // loads main.js / css / images from the deployed site (like bero-movies).
  return src("src/*.html")
    .pipe(inject.after("<head>", '\n    <base href="' + TIZEN_BASE + '">'))
    .pipe(dest("tizen/webapp"));
}

function copyHtml() {
  return src("src/*.html").pipe(dest("dist"));
}

const processHtml = series(copyTizenHtml, copyHtml);
const buildTs = series(build);

const DEV_PORT = process.env.PORT || 3000;
function serve() {
  const server = gls.static("dist", DEV_PORT);
  server.start();
  const reflectChangesAnd = (task) => (cb) => {
    server.notify();
    return task(cb);
  };
  watch("src/ts/**/*.ts", reflectChangesAnd(buildTs));
  watch("src/css/**/*", reflectChangesAnd(copyCss));
  watch("src/images/**/*", reflectChangesAnd(copyImages));
  watch("src/*.html", reflectChangesAnd(processHtml));
}

exports.build = series(build, copyCss, copyImages, processHtml);
exports.watch = series(exports.build, serve);
