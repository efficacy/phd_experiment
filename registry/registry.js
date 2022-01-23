const express = require('express')
const fs = require('fs')
const { Roles, Client } = require('../shared/main')
const stores = {
  memory: require('./store/memory').create(),
  files: require('./store/files').create()
}

const client = new Client({ role: Roles.REGISTRY, port: 3001, store: 'files' })
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
  store.getLeaseDurationInMillis(role, (err, duration) => {
    if (err) return res.send(err)
    let end = now + duration
    store.addIpAddressLease(role, address, end, (err) => {
      if (err) return res.send(err)
      var index = ""
      store.each((lease) => {
        if (lease.when > now) {
          if (index.length > 0) {
            index += ',\n'
          }
          index += `"${lease.role}":"${lease.address}"`
        }
      }, (err) => {
        if (err) return res.send(err)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('X-Lease-Expiry', end)

        let registry = settings.self
        store.getVersion((err, version) => {
          if (err) {
            return res.send(err)
          }
          store.getVersionData((err, versionData) => {
            if (err) {
              return res.send(err)
            }
            let response = `{
              "version": ${version},
              "role": "${role}",
              "registry": "${registry}",
              "script": ${versionData.scripts[role + '.sh'] || null},
              "addresses": {
                ${index}
              }
            }`
            return res.send(response)
          })
        })
      })
    })
  })
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
  res.setHeader('Content-Type', 'text/plain')
  if (role) {
    let address = store.getAddress(role, now)
    if (address) {
      return res.send(`OK ${address}`)
    }
  } else {
    var n = 0;
    store.each((lease) => {
      if (lease.when >= now) {
        ++n
      }
    }, (err) => {
      return res.send(`N ${n}`)
    })
  }
})

app.get('/status', (req, res) => {
  let duration = req.query.duration
  if (duration) {
    store.setLeaseDurationInMillis(duration, (err) => {
      // don't need to wait for this. Maybe it should really be on its own endpoint?
    })
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
  }, (err) => {
    store.getLeaseDurationInMillis('OTHER', (err, duration) => {
      if (err) return res.send(err)
      ret += `</table><i>Lease duration: ${duration} milliseconds</i>`
      res.setHeader('Content-Type', 'text/html')
      res.send(ret)
    })
  })
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

client.ensure((settings) => {
  app.set('settings', settings)
  store = stores[settings.store]
  store.refreshVersions((err, version) => {
    if (err) throw err
    // throw new Error("yikes")
    app.listen(settings.port, () => {
      if (settings.role == Roles.MIRROR) {
        client.register(settings.role, true, (err) => {
          if (err) throw err
          console.log(`* Registroy (Mirror) listening on ${settings.self}`)
        })
      } else {
        console.log(`* Registry (Primary) listening on ${settings.self}`)
      }
    })
  })
})
