const express = require('express')
const { Roles, Client, Config, Requester } = require('../shared/main')

const SERVICE = "Control"

const app = express()
const dfl_port = 9999

let status = 'OK'
app.get('/status', (req, res) => {
  res.send(status)
})

let logger = new Requester()

app.get('/run', (req, res) => {
  let session = req.query.s
  logger.call('192.168.0.50:9996', 'setup', `s=${session}`, (err) =>{
    status = 'BUSY'
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || 'OK')
    console.log(`starting dummy child`)
    setTimeout(() => {
      console.log(`dummy child complete`)
      status = 'OK'
    }, 5000)
  })
})


app.use(express.static('static'))

function init(port, callback) {
  let config = new Config({ port: port })
  config.ensure((settings) => {
    app.set('client', new Client(Roles.CONTROL, Config.toURL(settings)))
    app.set('settings', settings)
    if (callback) return callback(null, app, settings)
  })
}

function shutdown() {
  let service = app.get('service')

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
      console.log(`* ${SERVICE} listening on ${Config.toURL(settings)}`)
      app.get('client').register(true, (err, expiry, config) => {
        if (err) throw err
        console.log(`* ${SERVICE} registered with Registry on ${settings.registry} renew in ${expiry - Date.now()}ms`)
      })
    })
    app.set('service', service)
  })
}

module.exports = {
  init: init
}
