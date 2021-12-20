const express = require('express')
const fs = require('fs')
const MemoryStore = require('./store/memory')
const FileStore = require('./store/files')
const {
  Client
} = require('../shared')

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

let store = null
const MIRROR = 'MIRROR'

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

app.get('/selfcheck', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send('OK')
})

app.get('/register', (req, res) => {
  let role = req.query.role
  let address = req.query.address
  let now = Date.now()
  let end = now + store.getLeaseDurationInMillis(role)

  store.addIpAddressLease(role, address, end)
  var index = ""
  store.each((lease) => {
    if (lease.when > now) {
      if (index.length > 0) {
        index += ',\n'
      }
      index += `"${lease.role}":"${lease.address}"`
    }
  })
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-Lease-Expiry', end)

  let server = client.getSelf()
  if (role != MIRROR) {
    let mirror = store.getAddress(MIRROR)
    if (mirror) {
      server = `${mirror}`
    }
  }

  let version = store.getVersion()
  let versionData = store.getVersionData()
  let response = `{
    "version": ${version},
    "role": "${role}",
    "server": "${server}",
    "script": "${versionData[version].scripts[role + '.sh'] || null}",
    "addresses": {
      ${index}
    }
  }`
  res.send(response)
})

app.get('/deregister', (req, res) => {
  let role = req.query.role

  store.removeIpAddressLease(role)
  res.setHeader('Content-Type', 'text/plain')
  res.send('OK')
})

app.get('/lookup', (req, res) => {
  let role = req.query.role
  let now = Date.now()
  var ret = `E no address found for ${role}`
  if (role) {
    let address = store.getAddress(role, now)
    if (address) {
      ret = `OK ${address}`
    }
  } else {
    var n = 0;
    store.each((lease) => {
      if (lease.when >= now) {
        ++n
      }
    })
    ret = `N ${n}`
  }
  res.setHeader('Content-Type', 'text/plain')
  res.send(ret)
})

app.get('/status', (req, res) => {
  let duration = req.query.duration
  if (duration) {
    store.setLeaseDurationInMillis(duration)
  }

  let now = Date.now()
  var ret = "<table border='1'><tr><th>Name</th><th>Address</th><th>Status</th><th>Operations</th></tr>\n"
  store.each((lease) => {
    ret += `<tr><td>${lease.role}</td><td>${lease.address}</td><td>`
    let expiry = new Date(lease.when)
    // .format("yyyy-mm-dd HH:MM:ss l")
    if (lease.when < now) {
      ret += "<span style='color:red'>EXPIRED</span>"
    } else {
      ret += "<span style='color:green'>ACTIVE</span>"
    }
    ret += "</td>\n"
    ret += `<td><a href='#' onclick='remove("${lease.role}", "output-${lease.role}")'>remove</a> <span id="output-${lease.role}"></span></td>`
    ret += "</tr>\n"
  })
  ret += `</table><i>Lease duration: ${store.getLeaseDurationInMillis('OTHER')} milliseconds</i>`
  res.setHeader('Content-Type', 'text/html')
  res.send(ret)
})

app.get('/refresh', (req, res) => {
  refreshVersions(err => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  })
})

app.get('/remove', (req, res) => {
  let role = req.query.role
  store.removeIpAddressLease(role, (err) => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  })
})

app.get('/clear', (req, res) => {
  store.clear((err) => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  })
})

app.use(express.static('static'))

function init(_store, cb) {
  store = _store || new FileStore('leases.txt')
  store.refreshVersions((err, version) => {
    cb(err, app, port, primary, version)
  })
}

module.exports = {
  init: init
}