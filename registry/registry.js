const express = require('express')
const fs = require('fs')
const { inherits } = require('util')
const { Roles, Config } = require('../shared/main')
const stores = {
  memory: require('./store/memory').create(),
  files: require('./store/files').create()
}

const dfl_port = 9997
const dfl_lease_duration = 10000

const app = express()

let lease_duration = dfl_lease_duration
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
  let address = req.query.address
  let store = app.get('store')

  console.log(`* deregister role=${role} address=${address}`)
  store.endIpAddressLease(role, address, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    if (err) {
      return res.send(err)
    }
    res.send('OK')
  })
})

app.get('/remove', (req, res) => {
  let role = req.query.role
  let address = req.query.address
  let store = app.get('store')

  console.log(`* remove role=${role} address=${address}`)
  store.removeIpAddressLease(role, address, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    if (err) {
      return res.send(err)
    }
    res.send('OK')
  })
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
        console.log(`registry/lookup(${role})->${address}`)
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
  var ret = { duration: getLeaseDurationInMillis('OTHER'), leases: [] }
  store.each((lease) => {
    let record = {
      expiry: new Date(lease.when),
      status: lease.status,
      role: lease.role,
      address: lease.address
    }
    ret.leases.push(record)
  }, (err) => {
    res.setHeader('Content-Type', 'application/json')
    let response = JSON.stringify(ret)
    res.send(response)
  })
})

app.get('/refresh', (req, res) => {
  refreshVersions(err => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  })
})

app.get('/clear', (req, res) => {
  let store = app.get('store')

  store.clear((err) => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  })
})

app.get('/shutdown', (req, res) => {
  let store = app.get('store')

  store.close(() => {
    let service = app.get('service')
    res.send('OK')
    service.close(() => {
      console.log(`* Registry (Primary) shutdown`)
      process.exit()
    })
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
    app.set('service', ret)
  })
}

module.exports = {
  init: init
}