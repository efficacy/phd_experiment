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

  console.log(`starting warmup sequence...`)
  async.series([
    // Step 1. Baseline measurement - call bstart on logger, wait a while, then call bstop
    (next) => {
      console.log(` step 1: logger setup`)
      requester.call(logger, 'setup', `scenario=${scenario}&session=${session}&description=${description}`, (err) => {
        let message = err ? `err=${err}` : `OK`
        console.log(`  logger initialised ${message}`)
        if (!err) {
          status.running = true
          status.scenario = scenario
          status.session = session
        }
        return next(err)
      })
    },
    (next) => {
      let script = `./warmup.sh ${me}dut_ready`
      console.log(` step 2: run dut warmup script: ${script}`)
      requester.ssh(dut, script, (err) => {
        let message = err ? `err=${err}` : `OK`
        console.log(`  dut warmup script sent, ${message}`)
        return next(err)
      })
    },
    (next) => {
      let script = `./warmup.sh ${me}load_ready`
      console.log(` step 3: run load warmup script: ${script}`)
      requester.ssh(load, script, (err) => {
        let message = err ? `err=${err}` : `OK`
        console.log(`  load warmup script sent, ${message}`)
        return next(err)
      })
    },

  ], (err, result) => {
    let message = err ? `err=${err}` : `OK`
    console.log(`async warmup sequence complete ${message}`)
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
  let dut = app.get('dut')
  let load = app.get('load')

  let process = measure()
  status.child = true
  app.set('measurer', process)

  console.log(`starting baseline sequence...`)
  // Baseline measurement - call bstart on logger, wait a while, then call bstop
  async.series([
    (next) => {
      console.log(` step 1: call bstart on logger`)
      requester.call(logger, 'bstart', '', (err) => {
        return next(err)
      })
    },
    (next) => {
      console.log(` step 2: wait for baseline period`)
      setTimeout(() => {
        return next()
      }, BASELINE_PERIOD)
    },
    (next) => {
      console.log(` step 3: call bstop on logger`)
      requester.call(logger, 'bstop', '', (err) => {
        return next(err)
      })
    },

    // Main measurement - call mstart on logger, then ssh to start LOAD
    (next) => {
      console.log(`starting main sequence...`)
      console.log(` step 1: call mstart on logger`)
      requester.call(logger, 'mstart', '', (err) => {
        return next(err)
      })
    },
    (next) => {
      console.log(` step 2: run load script, wait for callback on /run_complete`)
      requester.ssh(load, `./run.sh ${me}run_complete`, (err) => {
        return next(err)
      })
    },
  ], (err, result) => {
    let message = err ? `with err ${err}` : `OK`
    console.log(`main sequence ${scenario}/${session} initiated ${message}`)
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
  let me = app.get('me')
  let dut = app.get('dut')
  let load = app.get('load')

  console.log(`endpoint /run_complete me=${me}`)
  status.running = false
  status.scenario = null
  status.session = null

  console.log(`stopping measurement...`)
  async.series([
    (next) => {
      console.log(` step 1: call mstop on logger`)
      requester.call(app.get('logger'), 'mstop', '', (err) => {
        console.log(`  logging stopped`)
        return next(err)
      })
    },
    (next) => {
      console.log(` step 2: stop measurement process`)
      kill_measurer(app, () => {
        console.log(`  measurement process stopped`)
        return next()
      })
    },
    (next) => {
      console.log(` step 3: call terminate on logger`)
      requester.call(app.get('logger'), 'terminate', '', (err) => {
        return next(err)
      })
    },
    (next) => {
      let script = `./cooldown.sh ${me}cooldown_complete`
      console.log(` step 2: run dut cooldown script: ${script}`)
      requester.ssh(dut, script, (err) => {
        console.log(`  dut cooldown script sent, err=${err}`)
        return next(err)
      })
    },
  ], (err, result) => {
    let message = err ? `with err ${err}` : `OK`
    console.log(`session ${scenario}/${session} terminated ${message}`)
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  })
})

app.get('/cooldown_complete', (req, res) => {
  console.log(`endpoint /cooldown_complete`)
  res.setHeader('Content-Type', 'text/plain')
  res.send('OK')
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
