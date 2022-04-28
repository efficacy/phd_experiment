const fs = require('fs');
const express = require('express')
const app = express()
const port = 3000

let base = './static'
let cache = {}

app.use((req, res, next) => {
  let url = req.originalUrl
  if (url == '/') url = '/index.html'
  if (url in cache) {
    console.log(`serving ${url} from cache`)
    res.send(cache[url])
  } else {
    let path = base + url
    console.log(`reading ${path}`)
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
      cache[url] = data
      res.send(data)
    });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
