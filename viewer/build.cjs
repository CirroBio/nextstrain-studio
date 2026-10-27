/* Builds Auspice with this folder's customisations into ../public/viewer/, as static files that work
 * under any path. `auspice build` assumes it is served at the root (publicPath /dist/) and reads the
 * page's path as a dataset name, so this runs Auspice's own webpack config with those changed. */
const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const generateConfig = require("auspice/webpack.config.cjs").default;

const extensionPath = path.resolve(__dirname, "ext/config.json");
const outputPath = path.resolve(__dirname, "../public/viewer");

process.env.BABEL_ENV = "production";
process.env.BABEL_EXTENSION_PATH = extensionPath;

const config = generateConfig({ extensionPath, devMode: false, customOutputPath: __dirname });
config.output.path = outputPath;
config.output.publicPath = "auto";
// Static hosts compress on the fly; precompressed copies would only double the upload.
config.plugins = config.plugins.filter((p) => p.constructor.name !== "CompressionPlugin");

/* Auspice picks its page from location.pathname and fetches anything but "/" from a server this
 * site doesn't have, so the page moves itself to "/" before Auspice starts. The bundles are then
 * loaded from where the page really is, which is why their tags are written here, not in the HTML. */
function loadFromHere(html) {
  const bundles = [...html.matchAll(/<script src=([^ >]+)><\/script>/g)].map((m) => m[1]);
  if (bundles.length === 0) throw new Error("No script tags found in Auspice's index.html");
  const loader = `<script>(function(){var here=location.pathname.replace(/[^/]*$/,"");history.replaceState(null,"","/"+location.search+location.hash);${JSON.stringify(bundles)}.forEach(function(b){var s=document.createElement("script");s.src=here+b;s.async=false;document.head.appendChild(s);});})();</script>`;
  return html.replace(/<script src=[^>]+><\/script>/g, "").replace("</head>", `${loader}</head>`).replace(/href=\/favicon\.png/g, "href=favicon.png");
}

webpack(config).run((err, stats) => {
  if (err) throw err;
  if (stats.hasErrors()) {
    console.error(stats.toString({ all: false, errors: true }));
    process.exit(1);
  }
  const index = path.join(outputPath, "index.html");
  fs.writeFileSync(index, loadFromHere(fs.readFileSync(index, "utf8")));
  fs.copyFileSync(require.resolve("auspice/favicon.png"), path.join(outputPath, "favicon.png"));
  console.log(`Viewer built in ${path.relative(process.cwd(), outputPath)}`);
});
