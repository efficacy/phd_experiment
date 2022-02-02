const express = require('express')
const fs = require('fs')
const { inherits } = require('util')
const { Roles, Config } = require('../shared/main')
const stores = {
  memory: require('./store/memory').create(),
  files: require('./store/files').create()
}

const app = express()
const dfl_port = 9997

let lease_duration = 12000
function getLeaseDurationInMillis(role) {
  // TODO adapt for different roles and over time?
  return lease_duration
}

app.get('/selfcheck', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send('OK')
})

app.get('/register', (req, res) => {
  let role = req.query.role
  let address = req.query.address
  let settings = app.get('settings')
  let store = app.get('store')
  let now = Date.now()
  let duration = getLeaseDurationInMillis(role)
  let end = now + duration
  console.log(`* register role=${role} address=${address} lease=${duration}ms`)
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

      let registry = `${settings.host}:${settings.port}`
      store.getVersion((err, version) => {
        if (err) {
          return res.send(err)
        }
        store.getVersionData((err, versionData) => {
          if (err) {
            return res.send(err)
          }
          let script = null
          if ('scripts' in versionData) {
            if ((role + '.sh') in versionData.scripts) {
              script = versionData.scripts[role + '.sh']
            }
          }
          let response = `{
              "version": ${version},
              "role": "${role}",
              "registry": "${registry}",
              "script": ${script},
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

app.get('/deregister', (req, res) => {
  let role = req.query.role
  let store = app.get('store')

  store.removeIpAddressLease(role)
  res.setHeader('Content-Type', 'text/plain')
  res.send('OK')
})

app.get('/lookup', (req, res) => {
  let role = req.query.role
  let store = app.get('store')
  let now = Date.now()
  let ret = `E no address found for ${role}`
  res.setHeader('Content-Type', 'text/plain')
  if (role) {
    let address = store.getAddress(role, now, (err, address) => {
      if (err) {
        return res.send(`E ${err}`)
      }
      if (address) {
        return res.send(`OK ${address}`)
      }
    })
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
  let store = app.get('store')

  if (req.query.duration) {
    lease_duration = parseInt(req.query.duration)
    //TODO Maybe this should really be on its own endpoint?
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
    duration = getLeaseDurationInMillis('OTHER')
    ret += `</table><i>Lease duration: ${duration} milliseconds</i>`
    res.setHeader('Content-Type', 'text/html')
    res.send(ret)
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

function init(store, port, callback) {
  let config = new Config({ port: port })
  config.ensure((settings) => {
    app.set('settings', settings)
    app.set('store', store)
    store = store || stores[settings.store]
    store.refreshVersions((err, version) => {
      if (callback) return callback(err, app, settings)
    })
  })
}

if (require.main === module) {
  init(stores.memory, dfl_port, (err, app, settings) => {
    if (err) throw err
    let ret = app.listen(settings.port, () => {
      console.log(`* Registry (Primary) listening on ${Config.toURL(settings)}`)
    })
  })
}

module.exports = {
  init: init
}