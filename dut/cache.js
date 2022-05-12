const fs = require('fs');
const express = require('express')
const app = express()
const port = 3000

let base = './static'
let cache = {}

function send(url, res, data, callback) {
  let type = 'text/plain'
  if (url.endsWith('.html')) {
    type = 'text/html'
  } else if (url.endsWith('.css')) {
    type = 'text/css'
  } else if (url.endsWith('.png')) {
    type = 'image/png'
  } else if (url.endsWith('.js') || url.endsWith('.js.download')) {
    type = 'text/javascript'
  }
  res.setHeader('Content-Type', type);
  res.send(data)
  if (callback) callback()
}

app.use((req, res, next) => {
  let url = req.originalUrl
  if (url == '/') url = '/index.html'
  if (url in cache) {
    console.log(`serving ${url} from cache`)
    send(url, res, cache[url], next)
  } else {
    let path = base + url
    console.log(`reading ${path}`)
    fs.readFile(path, (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      cache[url] = data
      send(url, res, data, next)
    });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
