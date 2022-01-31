const express = require('express')
const { Roles, Client, Config } = require('../shared/main')
const stores = {
  // memory: require('./store/memory').create(),
  // mysql: require('./store/mysql').create(),
  files: require('./store/files').create(),
  postgres: require('./store/postgres').create()
}

const client = new Client({ role: Roles.LOGGER, port: 3002, store: 'postgres' })
const app = express()

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
  store.truncate((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/rebuild', (req, res) => {
  let store = app.get('store')
  store.rebuild((err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/setup', (req, res) => {
  let store = app.get('store')
  let session = req.query.s
  store.setup(session, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.get('/log', (req, res) => {
  let store = app.get('store')
  let stamp = req.query.t
  let voltage = req.query.v
  let current = req.query.i
  store.append(stamp, voltage, current, (err) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
  })
})

app.use(express.static('static'))

function init(store, port, callback) {
  let config = new Config({port: port})
  config.ensure((settings) => {
    store = store || stores[settings.store]
    app.set('settings', settings)
    app.set('store', store)
    store.start((err) => {
      console.log(`Database initialisation: ${err}`)
        if (callback) return callback(err, app, settings)
    })
  })
}

function listen(app, settings, callback) {
  let ret = app.listen(settings.port, () => {
    console.log(`* Logger listening on ${Config.toURL(settings)}`)
    if (callback) return callback(null, app, settings)
  })
  return ret
}

if (require.main === module) {
  init(stores.memory, (err, app, settings) => {
    if (err) throw err
    listen(app, settings, (err, app, settings) => {
      if (err) throw err
      client.register(settings.role, true, (err) => {
        if (err) throw err
        console.log(`* Logger registered with Registry on ${settings.registry}`)
      })
    })
  })
}

module.exports = {
  init: init,
  listen: listen
}
