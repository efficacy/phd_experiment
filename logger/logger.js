const express = require('express')
const { Roles, Client } = require('../shared/main')
const stores = {
  // memory: require('./store/memory').create(),
  // mysql: require('./store/mysql').create(),
  postgres: require('./store/postgres').create()
}

const client = new Client({ role: Roles.LOGGER, port: 3002, store: 'postgres' })
const app = express()

app.get('/status', (req, res) => {
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
console.log(`logger about to get settings`)

client.ensure((settings) => {
  app.set('settings', settings)
  store = stores[settings.store]
  store.start((err) => {
    console.log(`Database initialisation: ${err}`)
    app.listen(settings.port, () => {
      client.register(settings.role, true, (err) => {
        if (err) throw err
        console.log(`* Logger listening on port ${settings.self}`)
      })
    })
  })
})
