const fs = require('fs');
const express = require('express')
const app = express()

let options = {
  r: '/var/www/html',
  p: 8000,
  c: false,
  v: false
}
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
  if (url.endsWith('/')) url += 'index.html'
  if (url in cache) {
    if (options.v) console.log(`cache hit ${url}`)
    send(url, res, cache[url], next)
  } else {
    if (options.v) console.log(`read file ${url}`)
    let path = options.r + url
    console.log(`reading ${path}`)
    fs.readFile(path, (err, data) => {
      if (err) {
        console.error(err);
        return next();
      }
      if (options.c) cache[url] = data
      send(url, res, data, next)
    });
  }
});

let args = process.argv.slice(2)
let i = 0
while (i <args.length) {
  let arg = args[i]
  if (arg.startsWith('-')) {
    let c = arg.charAt(1)
    switch (c) {
      case 'r':
        options.r = args[++i]
        break
      case 'p':
        options.p = args[++i].parseInt()
        break
      case 'c':
        options.c = true
        break
      case 'v':
        options.v = true
        break
      default:
        throw `Unknown argument ${arg}`
    }
  } else {
    options.r = arg
  }
  ++i
}

app.listen(options.p, () => {
  console.log(`Node server listening on port ${options.p} serving ${options.r} cache=${options.c}`)
})
