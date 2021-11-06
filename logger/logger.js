const express = require('express')
const memstore = require('./logstore-memory')
const sqlstore = require('./logstore-mysql')
const {Client} = require('../shared')

const app = express()

let port = null
let primary = null
var args = process.argv.slice(2);
if (args.length > 0) {
  port = parseInt(args[0])
}
if (args.length > 1) {
  primary = args[1]
}
port = port || normalizePort(process.env.PORT || '3002');

let store = process.env.STORE == 'memory' ? memstore : sqlstore;
let client = new Client('192.168.1.1', port)

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

app.get('/setup', (req, res) => {
  let session = req.query.s
  store.setup(session)
  res.setHeader('Content-Type', 'text/plain')
  res.send(`OK`)
})

app.get('/log', (req, res) => {
  let stamp = req.query.t
  let voltage = req.query.v
  let current = req.query.i
  store.append(stamp, voltage, current)
  res.setHeader('Content-Type', 'text/plain')
  res.send(`OK`)
})

app.get('/rebuild', (req, res) => {
  store.rebuild()
  res.setHeader('Content-Type', 'text/plain')
  res.send(`OK`)
})

store.start()
app.listen(port, () => {
  if (primary) {
    client.register(primary, 'LOGGER', true)
  }
  console.log(`Example app listening on port ${port}`)
})