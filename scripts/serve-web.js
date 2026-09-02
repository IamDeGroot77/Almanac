// Serves a web export at the same base path GitHub Pages will use, so the
// laptop build can be checked locally: node scripts/serve-web.js <dist> [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8090);
const base = '/Almanac/app';
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

http
  .createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/' || url === base || url === base + '/') url = base + '/index.html';
    if (!url.startsWith(base + '/')) {
      res.writeHead(302, { Location: base + '/' });
      return res.end();
    }
    let file = path.join(dist, url.slice(base.length + 1));
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`serving ${dist} at http://localhost:${port}${base}/`));
