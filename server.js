var http = require("http");
var fs = require("fs");
var path = require("path");
var puerto = Number(process.argv[2]) || 8080;
var raiz = process.cwd();
var tipos = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".map": "application/json"
};
http.createServer(function (req, res) {
  var url;
  try {
    url = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  } catch (e) {
    res.writeHead(400);
    return res.end("400");
  }
  if (url === "/") url = "/index.html";
  var ruta = path.normalize(path.join(raiz, url));
  var rel = path.relative(raiz, ruta);
  if (rel === ".." || rel.indexOf(".." + path.sep) === 0 || path.isAbsolute(rel)) {
    res.writeHead(403);
    return res.end("403");
  }
  fs.stat(ruta, function (err, st) {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end("404");
    }
    var ext = path.extname(ruta).toLowerCase();
    res.writeHead(200, {
      "Content-Type": tipos[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(ruta).pipe(res);
  });
}).listen(puerto, "0.0.0.0", function () {
  console.log("Escuchando en 0.0.0.0:" + puerto);
});