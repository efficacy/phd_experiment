const express = require('express')
const { Roles, Client, Config, Requester } = require('../shared/main')
const { spawn } = require('child_process');

const SERVICE = "Control"

const app = express()
const dfl_port = 9999
let VERBOSE = process.env.VERBOSE || false

let status = { running: false, child: false, dut_ready: false, load_ready: false, scenario: null, session: null }
app.get('/status', (req, res) => {
  let s = JSON.stringify(status)
  if (VERBOSE) console.log(`requested status, returned ${s}`)
  res.send(s)
})

let requester = new Requester()

function measure() {
  const measurer = spawn('python', ['./main.py']);
  measurer.stdout.on('data', (data) => {
      console.log(`P ${data.toString()}`);
  });
  measurer.stdout.on('end', () => {
    console.log(`child process ended`)
  })
  measurer.on('error', (err) => {
    console.log(`child process error: ${err}`)
  })
  return measurer
}

function run(scenario, session, callback) {
  status.dut_ready = false
  status.load_ready = false
  requester.call(app.get('logger'), 'start', `scenario=${scenario}&session=${session}`, (err) =>{
    console.log(`run err=${err}`)
    if (err) callback(err)
    status.running = true
    status.scenario = scenario
    status.session = session

    console.log(`starting measurement process `)
    let process = measure()
    status.child = true
    app.set('measurer', process)
    if (callback) callback(session)
  })
}

function kill_measurer(app, callback) {
  let process = app.get('measurer')
  if (process) {
    process.kill('SIGINT')
    status.child = false
    app.set('measurer', null)
    console.log(`stopped measurement process`)
  } else {
    console.log(`measurement process not running`)
  }
  if (callback) {
    callback()
  }
}

app.get('/start', (req, res) => {
  let scenario = req.query.scenario
  let session = req.query.session
  console.log(`start scenario ${scenario} session ${session}`)
  status.dut_ready = false
  status.load_ready = false
  app.set('scenario', scenario)
  app.set('session', session)
  // TODO ssh to set up DUT for scenario, will callback on /dut_ready when done
  // TODO ssh to set up LOAD for scenario, will callback on /load_ready when done
  res.setHeader('Content-Type', 'text/plain')
  res.send(`OK ${scenario}/${session}`)
})

app.get('/dut_ready', (req, res) => {
  status.dut_ready = true
  console.log(`DUT ready`)
  if (status.load_ready) {
    let scenario = app.get('scenario')
    let session = app.get('session')
      run(scenario, session, () => {
      res.setHeader('Content-Type', 'text/plain')
      res.send(`OK Run ${scenario}/${session}`)
    })
  } else {
    res.setHeader('Content-Type', 'text/plain')
    res.send(`OK DUT READY`)
  }
})

app.get('/load_ready', (req, res) => {
  status.load_ready = true
  console.log(`LOAD ready`)
  if (status.dut_ready) {
    let scenario = app.get('scenario')
    let session = app.get('session')
    run(scenario, session, () => {
      res.setHeader('Content-Type', 'text/plain')
      res.send(`OK Run ${scenario}/${session}`)
    })
  } else {
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK LOAD READY')
  }
})

app.get('/run', (req, res) => {
  let scenario = req.query.scenario
  let session = req.query.session
  run(scenario, session, (session) => {
    res.setHeader('Content-Type', 'text/plain')
    res.send(err || `OK ${session}`)
  })
})

app.get('/run_complete', (req, res) => {
  kill_measurer(app, () => {
    console.log(`session complete`)
    status.running = false
    status.scenario = null
    status.session = null
    requester.call(app.get('logger'), 'stop', '', (err) => {
      res.setHeader('Content-Type', 'text/plain')
      res.send('OK')
    })
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
  console.log(`*${new Date()} ${SERVICE} in shutdown`)
  let service = app.get('service')

  kill_measurer(app, () => {
    service.close(() => {
      let client = app.get('client')
      let settings = app.get('settings')

      client.deregister((err) => {
        if (err) throw err
        console.log(`*{new Date()} ${SERVICE} deregistered from Registry on ${settings.registry}`)
        console.log(`*{new Date()} ${SERVICE} shutdown`)
        process.exit();
      })
    })
  })
}

if (require.main === module) {
  console.log('--------')
  let exiting = false

  process.on('SIGINT', () => {
    console.log("Caught interrupt signal");
    shutdown()
  });

  init(dfl_port, (err, app, settings) => {
    if (err) throw err
    let service = app.listen(settings.port, () => {
      console.log(`*${new Date()} ${SERVICE} listening on ${Config.toURL(settings)}`)
      app.get('client').register(true, (err, expiry, config) => {
        if (err) throw err
        console.log(`*${new Date()} ${SERVICE} registered with Registry on ${settings.registry} renew in ${expiry - Date.now()}ms`)
      })
      app.get('client').lookup(Roles.LOG, settings, (endpoint) => {
        console.log(`*${new Date()} ${SERVICE} looked up logger: ${endpoint}`)
        app.set('logger', endpoint)
      })
    })
    app.set('service', service)
  })
}

module.exports = {
  init: init
}
