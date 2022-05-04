const async = require('async')
const express = require('express')
const { Roles, Client, Config, Requester } = require('../shared/main')
const { spawn, exec } = require('child_process');

const SERVICE = "Control"
const BASELINE_PERIOD = 30000 // thirty seconds

const app = express()
const dfl_port = 9999
let VERBOSE = process.env.VERBOSE || false

let requester = new Requester()

function measure() {
  const measurer = spawn('python', ['./main.py']);
  measurer.stdout.on('data', (data) => {
    let lines = data.toString().split('\n')
    for (i in lines) {
      let line = lines[i].trim()
      if (line) console.log(`P ${line}`);
    }
  });
  measurer.stdout.on('end', () => {
    console.log(`child process ended`)
  })
  measurer.on('error', (err) => {
    console.log(`child process error: ${err}`)
  })
  return measurer
}

let status = { running: false, child: false, dut_ready: false, load_ready: false, scenario: null, session: null }
app.get('/status', (req, res) => {
  let s = JSON.stringify(status)
  if (VERBOSE) console.log(`requested status, returned ${s}`)
  res.send(s)
})

app.get('/run', (req, res) => {
  let scenario = req.query.scenario
  let session = req.query.session
  let description = req.query.description
  console.log(`endpoint /run ${scenario} session ${session} desc ${description}`)

  app.set('scenario', scenario)
  app.set('session', session)
  status.dut_ready = false
  status.load_ready = false

  let me = app.get('me')
  let logger = app.get('logger')
  let dut = app.get('dut')
  let load = app.get('load')

  console.log(`starting async sequence...`)
  async.series([
    // Step 1. Baseline measurement - call bstart on logger, wait a while, then call bstop
    (next) => {
      console.log(` step 1: logger setup`)
      requester.call(logger, 'setup', `scenario=${scenario}&session=${session}&description=${description}`, (err) => {
        console.log(`logger initialised err=${err}`)
        if (!err) {
          status.running = true
          status.scenario = scenario
          status.session = session
        }
        return next(err)
      })
    },
    (next) => {
      let script = `./ready.sh ${me}/dut_ready`
      console.log(` step 2: run dut ready script: ${script}`)
      requester.ssh(dut, script, (err) => {
        console.log(`dut script sent, err=${err}`)
        return next(err)
      })
    },
    (next) => {
      let script = `./ready.sh ${me}/dut_ready`
      console.log(` step 3: run load ready script: ${script}`)
      requester.ssh(load, script, (err) => {
        console.log(`dut script sent, err=${err}`)
        return next(err)
      })
    },

  ], (err, result) => {
    console.log(`async sequence complete, err=${err}`)
    res.setHeader('Content-Type', 'text/plain')
    let ret = err || `OK ${scenario}/${session}`
    res.send(ret)
  })
})

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

function bothReady(callback) {
  status.dut_ready = false
  status.load_ready = false

  let scenario = app.get('scenario')
  let session = app.get('session')
  let me = app.get('me')
  let logger = app.get('logger')
  let load = app.get('load')

  console.log(`starting measurement process `)
  let process = measure()
  status.child = true
  app.set('measurer', process)

  async.series([
    // Step 1. Baseline measurement - call bstart on logger, wait a while, then call bstop
    (next) => {
      requester.call(logger, 'bstart', '', (err) => {
        return next(err)
      })
    },
    (next) => {
      setTimeout(() => {
        return next()
      }, BASELINE_PERIOD)
    },
    (next) => {
      requester.call(logger, 'bstop', '', (err) => {
        return next(err)
      })
    },

    // Step 2. Start main measurement - call mstart on logger, then ssh to start LOAD
    // callback on /load_complete when done
    (next) => {
      requester.call(logger, 'mstart', '', (err) => {
        return next(err)
      })
    },
    (next) => {
      requester.ssh(load, `./run.sh ${me}/run_complete`, (err) => {
        return next(err)
      })
    },
  ], (err, result) => {
    console.log(`test sequence ${scenario}/${session} initiated with err ${err}`)
  })

  if (callback) callback(null)
}

app.get('/dut_ready', (req, res) => {
  console.log(`endpoint /dut_ready`)
  status.dut_ready = true
  console.log(`DUT ready`)
  if (status.load_ready) {
    bothReady((err) => {
      res.setHeader('Content-Type', 'text/plain')
      res.send(`OK RUN STARTED`)
    })
  } else {
    res.setHeader('Content-Type', 'text/plain')
    res.send(`OK DUT READY`)
  }
})

app.get('/load_ready', (req, res) => {
  console.log(`endpoint /load_ready`)
  status.load_ready = true
  console.log(`LOAD ready`)
  if (status.dut_ready) {
    bothReady((err) => {
      res.setHeader('Content-Type', 'text/plain')
      res.send(`OK RUN STARTED`)
    })
  } else {
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK LOAD READY')
  }
})

app.get('/run_complete', (req, res) => {
  console.log(`endpoint /run_complete`)
  status.running = false
  status.scenario = null
  status.session = null
  requester.call(app.get('logger'), 'mstop', '', (err) => {
    console.log(`logging stopped`)
    kill_measurer(app, () => {
      console.log(`measurement process stopped`)
      requester.call(app.get('logger'), 'terminate', '', (err) => {
        console.log(`session terminated`)
        res.setHeader('Content-Type', 'text/plain')
        res.send('OK')
      })
    })
  })
})

app.get('/shutdown', (req, res) => {
  res.setHeader('Content-Type', 'text/plain')
  res.send(`OK`)
  shutdown()
})

app.get('/powerdown', (req, res) => {
  let settings = app.get('settings')

  app.get('client').lookup(Roles.LOAD, settings, (endpoint) => {
    command(endpoint, `sudo shutdown now`, () => {
      console.log('LOAD shutdown')
    })
  })
  app.get('client').lookup(Roles.DUT, settings, (endpoint) => {
    command(endpoint, `sudo shutdown now`, () => {
      console.log('DUT shutdown')
    })
  })
  shutdown(() => {
    console.log(`All those moments will be lost in time, like tears in rain... Time to die.`)
    exec(`sudo shutdown now`)
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

function shutdown(callback) {
  console.log(`*${new Date()} ${SERVICE} in shutdown`)
  let service = app.get('service')

  kill_measurer(app, () => {
    service.close(() => {
      let client = app.get('client')
      let settings = app.get('settings')

      client.deregister((err) => {
        if (err) throw err
        let now = new Date()
        console.log(`*${now} ${SERVICE} deregistered from Registry on ${settings.registry}`)
        console.log(`*${now} ${SERVICE} shutdown`)
        if (callback) {
          callback()
        } else {
          process.exit()
        }
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
      let client = app.get('client')
      let me = Config.toURL(settings)
      app.set("me", me)

      console.log(`*${new Date()} ${SERVICE} listening on ${me}`)
      client.register(true, (err, expiry, config) => {
        if (err) throw err
        console.log(`*${new Date()} ${SERVICE} registered with Registry on ${settings.registry} renew in ${expiry - Date.now()}ms`)
      })
      client.lookup(Roles.LOG, settings, (endpoint) => {
        console.log(`*${new Date()} ${SERVICE} looked up LOG: ${endpoint}`)
        app.set('logger', endpoint)
      })
      client.lookup(Roles.LOAD, settings, (endpoint) => {
        console.log(`*${new Date()} ${SERVICE} looked up LOAD: ${endpoint}`)
        app.set('load', endpoint)
      })
      client.lookup(Roles.DUT, settings, (endpoint) => {
        console.log(`*${new Date()} ${SERVICE} looked up DUT: ${endpoint}`)
        app.set('dut', endpoint)
      })
    })
    app.set('service', service)
  })
}

module.exports = {
  init: init
}
