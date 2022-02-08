const service_name = 'Dashboard'
const service_key = 'DASH'

const express = require('express')
const { Roles, Client, Config } = require('../shared/main')

const app = express()
const dfl_port = 8080

app.get('/services', (req, res) => {
  console.log(`get services...`)
  res.setHeader('Content-Type', 'text/plain')
  res.send(JSON.stringify([]))
})

app.get('/shutdown', (req, res) => {
  console.log(`shutdown...`)
  res.send('OK')
  shutdown()
})

app.use(express.static('static'))

function init(port, callback) {
  let config = new Config({ port: port })
  config.ensure((settings) => {
    app.set('client', new Client(Roles.DASHBOARD, Config.toURL(settings)))
    app.set('settings', settings)
    return callback(null, app, settings)
  })
}

function shutdown() {
  let service = app.get('service')

  service.close(() => {
    let client = app.get('client')
    let settings = app.get('settings')

    client.deregister((err) => {
      if (err) throw err
      console.log(`* ${service_name} deregistered from Registry on ${settings.registry}`)
      console.log(`* ${service_name} shutdown`)
      process.exit();
    })
  })
}

if (require.main === module) {
  let exiting = false

  process.on('SIGINT', () => {
    console.log("Caught interrupt signal");
    shutdown()
  });

  init(dfl_port, (err, app, settings) => {
    if (err) throw err
    let service = app.listen(settings.port, () => {
      console.log(`* ${service_name} listening on ${Config.toURL(settings)}`)
      app.get('client').register(true, (err, expiry, config) => {
        if (err) throw err
        console.log(`* ${service_name} registered with Registry on ${settings.registry} renew in ${expiry - Date.now()}ms`)
      })
    })
    app.set('service', service)
  })
}

module.exports = {
  init: init
}
