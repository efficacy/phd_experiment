const express = require('express')
const { Roles, Client, Config } = require('../shared/main')
const stores = {
  postgres: require('./store/postgres').create()
}

const SERVICE = "Logger"

const app = express()
const dfl_port = 9996

let VERBOSE = process.env.VERBOSE || false

app.get('/status', (req, res) => {
  let store = app.get('store')
  store.status((err, scenario, session, status, count) => {
    res.setHeader('Content-Type', 'text/plain')
    if (err) {
      res.send(JSON.stringify({ 'error': err }))
    } else {
      let ret = JSON.stringify({
        'scenario': scenario,
        'session': session,
        "status": status,
        'count': count
      })
      res.send(ret)
    }
  })
})

app.get('/truncate', (req, res) => {
  let store = app.get('store')
  if (VERBOSE) console.log(`endpoint /truncate`)
  store.truncate((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/rebuild', (req, res) => {
  let store = app.get('store')
  if (VERBOSE) console.log(`endpoint /rebuild`)
  store.rebuild((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/setup', (req, res) => {
  let store = app.get('store')
  let scenario = req.query.scenario
  let session = req.query.session
  let description = req.query.description
  if (VERBOSE) console.log(`endpoint /setup scenario=${scenario} session=${session} desc=${description}`)
  store.setup(scenario, session, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/bstart', (req, res) => {
  let store = app.get('store')
  if (VERBOSE) console.log(`endpoint /bstart`)
  store.bstart((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/bstop', (req, res) => {
  let store = app.get('store')
  if (VERBOSE) console.log(`endpoint /bstop`)
  store.bstop((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/mstart', (req, res) => {
  let store = app.get('store')
  if (VERBOSE) console.log(`endpoint /mstart`)
  store.mstart((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/mstop', (req, res) => {
  let store = app.get('store')
  if (VERBOSE) console.log(`endpoint /mstop`)
  store.mstop((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/terminate', (req, res) => {
  let store = app.get('store')
  if (VERBOSE) console.log(`endpoint /terminate`)
  store.terminate((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/log', (req, res) => {
  let store = app.get('store')
  let stamp = req.query.t
  let voltage = req.query.v
  let current = req.query.i
  if (VERBOSE) console.log(`endpoint /log stamp=${stamp} v=${voltage} i=${current}`)
  store.append(voltage, current, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/shutdown', (req, res) => {
  res.send('OK')
  shutdown()
})

app.use(express.static('static'))

function init(store, port, callback) {
  let config = new Config({ port: port })
  config.ensure((settings) => {
    store = store || stores[settings.store]

    app.set('client', new Client(Roles.LOG, Config.toURL(settings)))
    app.set('settings', settings)
    app.set('store', store)
    if (callback) return callback(null, app, settings)
  })
}

function shutdown() {
  let store = app.get('store')
  let service = app.get('service')

  store.close(() => {
    service.close(() => {
      let client = app.get('client')
      let settings = app.get('settings')

      client.deregister((err) => {
        if (err) throw err
        console.log(`* ${SERVICE} deregistered from Registry on ${settings.registry}`)
        console.log(`* ${SERVICE} shutdown`)
        process.exit();
      })
    })
  })
}

if (require.main === module) {
  let exiting = false

  process.on('SIGINT', () => {
    console.log("Caught interrupt signal");
    shutdown()
  });

  init(stores.postgres, dfl_port, (err, app, settings) => {
    if (err) throw err
    let service = app.listen(settings.port, () => {
      console.log(`* ${SERVICE} listening on ${Config.toURL(settings)}`)
      app.get('client').register(true, (err, expiry, config) => {
        if (err) throw err
        if (VERBOSE) console.log(`* ${SERVICE} registered with Registry on ${settings.registry} renew in ${expiry - Date.now()}ms`)
      })
    })
    app.set('service', service)
  })
}

module.exports = {
  init: init
}
