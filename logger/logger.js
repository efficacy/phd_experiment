const express = require('express')
const memstore = require('./logstore-memory')
const mysqlstore = require('./logstore-mysql')
const pgsqlstore = require('./logstore-postgres')
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

let store;
switch(process.env.STORE) {
  case 'memory':
    store = memstore;
    break;
  case 'mysql':
    store = mysqlstore;
    break;
  case 'pg':
  default:
    store = pgsqlstore;
}

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

app.get('/status', (req, res) => {
  store.status((err, session, count) => {
    res.setHeader('Content-Type', 'text/plain')
    if (err) {
      res.send(JSON.stringify({'error': err}))
    } else {
      let status = JSON.stringify({'session': session, 'count': count})
      res.send(status)
    }
  })
})

app.get('/truncate', (req, res) => {
  store.truncate((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err)
  })
})

app.get('/rebuild', (req, res) => {
  store.rebuild((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err)
  })
})

app.get('/setup', (req, res) => {
  let session = req.query.s
  store.setup(session, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err)
  })
})

app.get('/log', (req, res) => {
  let stamp = req.query.t
  let voltage = req.query.v
  let current = req.query.i
  store.append(stamp, voltage, current)
  res.setHeader('Content-Type', 'text/plain')
  res.send(`OK`)
})

app.use(express.static('static'))

store.start((err) => {
  console.log(`Database initialisation: ${err}`)
  app.listen(port, () => {
    if (primary) {
      client.register(primary, 'LOGGER', true)
    }
    console.log(`Experiment Logger listening on port ${port}`)
  })
})
