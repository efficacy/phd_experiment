const express = require('express')
const fs = require('fs')
const MemoryStore = require('./store/memory')
const FileStore = require('./store/files')
const { Roles, Client } = require('../shared/main')

const app = express()

let store = null

app.get('/selfcheck', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send('OK')
})

app.get('/register', (req, res) => {
  let role = req.query.role
  let address = req.query.address
  let settings = app.get('settings')
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

  let server = settings.getSelf()
  if (!settings.registry) {
    let mirror = store.getAddress(Roles.MIRROR)
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

function init(client, _store, cb) {
  client.ensure((settings) => {
    app.set('settings', settings)
    store = _store || new FileStore('leases.txt')
    store.refreshVersions((err, version) => {
      cb(err, app, version)
    })
  })
}

const client = new Client(Roles.REGISTRY, 3001)
client.ensure((settings) => {
  init(client, null, (err, app) => {
    if (err) throw err
    let settings = app.get('settings')
    console.log(`about to listen on port ${settings.port}`)
    // throw new Error("yikes")
    app.listen(settings.port, () => {
      if (settings.registry) {
        client.register(settings.registry, settings.role, true)
        console.log(`Central Server Mirror listening on port ${settings.port}`)
      } else {
        console.log(`Central Server Primary listening on port ${settings.port}`)
      }
    })
  })
})
