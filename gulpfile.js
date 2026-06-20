const { src, series, dest, watch } = require("gulp");
const ts = require("gulp-typescript");
const gls = require("gulp-live-server");
const inject = require("gulp-inject-string");

const tsProject = ts.createProject("tsconfig.json");

function build() {
  return src("src/ts/**/*.ts").pipe(tsProject()).pipe(dest("dist/js"));
}

function buildTizenService() {
  return src("src/ts/services/*.ts").pipe(tsProject()).pipe(dest("tizen/webapp/js/services"));
}

function copyCss() {
  return src("src/css/**/*").pipe(dest("dist/css"));
}

function copyImages() {
  return src("src/images/**/*").pipe(dest("dist/images"));
}

function copyTizenAssets() {
  src("src/css/**/*").pipe(dest("tizen/webapp/css"));
  return src("src/images/**/*").pipe(dest("tizen/webapp/images"));
}

function copyTizenHtml() {
  // On Tizen the app is packaged locally; no remote base href is injected.
  return src("src/*.html").pipe(dest("tizen/webapp"));
}

function copyHtml() {
  return src("src/*.html").pipe(dest("dist"));
}

const processHtml = series(copyTizenHtml, copyHtml);
const buildTs = series(build, buildTizenService);

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

exports.build = series(build, buildTizenService, copyCss, copyImages, copyTizenAssets, processHtml);
exports.watch = series(exports.build, serve);
