const express = require('express')
const { Roles, Client, Config } = require('../shared/main')
const stores = {
  postgres: require('./store/postgres').create()
}

const SERVICE = "Logger"
const VERBOSE = false

const app = express()
const dfl_port = 9996

app.get('/status', (req, res) => {
  let store = app.get('store')
  store.status((err, session, count) => {
    res.setHeader('Content-Type', 'text/plain')
    if (err) {
      res.send(JSON.stringify({ 'error': err }))
    } else {
      let status = JSON.stringify({ 'session': session, 'count': count })
      res.send(status)
    }
  })
})

app.get('/truncate', (req, res) => {
  let store = app.get('store')
  // console.log(`endpoint /truncate`)
  store.truncate((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/rebuild', (req, res) => {
  let store = app.get('store')
  // console.log(`endpoint /rebuild`)
  store.rebuild((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/start', (req, res) => {
  let store = app.get('store')
  let scenario = req.query.scenario
  let session = req.query.session
  // console.log(`endpoint /start scenario=${scenario} session=${session}`)
  store.start(scenario, session, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/stop', (req, res) => {
  let store = app.get('store')
  // console.log(`endpoint /stop`)
  store.stop((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/log', (req, res) => {
  let store = app.get('store')
  let stamp = req.query.t
  let voltage = req.query.v
  let current = req.query.i
  // console.log(`endpoint /log stamp=${stamp} v=${voltage} i=${current}`)
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
