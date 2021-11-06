const express = require('express')
const fs = require('fs')
const Store = require('./store/files')
const {Client} = require('../shared')

const app = express()

let port = null
let primary = null
var args = process.argv.slice(2);
if (args.length > 0) {
  port = parseInt(args[0])
}
if (args.length > 1) {
  primary = args[1]
}
port = port || normalizePort(process.env.PORT || '3002');

const store = new Store('leases.txt')

const MIRROR = 'MIRROR'

let client = new Client('192.168.1.1', port)
let version = -1
let versionData = {}

function getfs(rootDir, accept, cb) {
  fs.readdir(rootDir, function(err, files) {
    if (err) throw err
    let dirs = []
    for (var index = 0; index < files.length; ++index) {
      let file = files[index]
      if (file[0] !== '.') {
        let filePath = rootDir + '/' + file;
        fs.stat(filePath, function(err, stat) {
          if (accept(stat)) {
            dirs.push(this.file)
          }
          if (files.length === (this.index + 1)) {
            return cb(dirs)
          }
        }.bind({index: index, file: file}))
      }
    }
  })
}

function getdirs(rootDir, cb) {
  return getfs(rootDir, stat => stat.isDirectory(), cb)
}

function getfiles(rootDir, cb) {
  return getfs(rootDir, stat => stat.isFile(), cb)
}

function fileContents(fname, callback) {
  fs.readFile(fname, (err, buf) => {
    if (err) {
      console.error(err)
      return callback(err)
    }

    // otherwise log contents
    callback(null, buf.toString())
  });
}

function refreshVersions(callback) {
  let bestdir = null
  getdirs('versions', dirs => {
    for (let dir of dirs) {
      let v = parseFloat(dir)
      if (v > version) {
        version = v
        bestdir = dir
      }
    }
    console.log(`serving version ${version}`)

    fileContents('versions/' + bestdir + '/config.json', (err, s) => {
      if (!err) {
        versionData['config'] = JSON.parse(s)
      }
      let scripts = {}
      getfiles('versions/' + bestdir + '/scripts', scripts => {
        if  (scripts.length == 0) {
          return callback(err, version)
        }
        let done = 0
        for (let script of scripts) {
          fileContents('versions/' + bestdir + '/scripts/' + script, (err, s) => {
            ++done
            if (!err) {
              scripts[script] = s
            }
            if (done == scripts.length) {
              versionData['scripts'] = scripts
              callback(err, version)
            }
          })
        }
      })
    })
  })
}

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

app.get('/register', (req, res) => {
  let role = req.query.role
  let address = req.query.address
  let now = Date.now()
  let end = now + store.getLeaseDurationInMillis(role)

  store.addIpAddressLease(role, address, end)
  var index = ""
  store.each((lease) => {
    if (lease.when > now) {
      if (index.length > 0) {
        index += ',\n'
      }
      index += `"${lease.role}":"${lease.address}"`
    }
  })
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('X-Lease-Expiry', end)

  let server = client.getSelf()
  if (role != MIRROR) {
    let mirror = store.getAddress(MIRROR)
    if (mirror) {
      server = `${mirror}`
    }
  }

  res.send(`{
    "version": ${version},
    "role": "${role}",
    "server": "${server}",
    "script": "${versionData['scripts'][role + '.sh'] || null}",
    "addresses": {
      ${index}
    }
  }`)
})

app.get('/deregister', (req, res) => {
  let role = req.query.role
  let address = req.query.address

  store.removeIpAddressLease(role, address)
  res.setHeader('Content-Type', 'text/plain')

  res.send('OK')
})

app.get('/lookup', (req, res) => {
  let role = req.query.role
  let now = Date.now()
  var ret = `E no address found for ${role}`
  if (role) {
    let address = store.getAddress(role, now)
    if (address) {
      ret = `OK ${address}`
    }
  } else {
    var n = 0;
    store.each((lease) => {
      if (lease.when >= now) {
        ++n
      }
    })
    ret = `N ${n}`
  }
  res.setHeader('Content-Type', 'text/plain')
  res.send(ret)
})

app.get('/status', (req, res) => {
  let duration = req.query.duration
  if (duration) {
    store.setLeaseDurationInMillis(duration)
  }

  let now = Date.now()
  var ret = "<table border='1'><tr><th>Name</th><th>Address</th><th>Status</th><th>Operations</th></tr>\n"
  store.each((lease) => {
    ret += `<tr><td>${lease.role}</td><td>${lease.address}</td><td>`
    let expiry = new Date(lease.when)
    // .format("yyyy-mm-dd HH:MM:ss l")
    if (lease.when < now) {
      ret += "<span style='color:red'>EXPIRED</span>"
    } else {
      ret += "<span style='color:green'>ACTIVE</span>"
    }
    ret += "</td>\n"
    ret += `<td><a href='#' onclick='remove("${lease.role}", "output-${lease.role}")'>remove</a> <span id="output-${lease.role}"></span></td>`
    ret += "</tr>\n"
  })
  ret += `</table><i>Lease duration: ${store.getLeaseDurationInMillis('OTHER')} milliseconds</i>`
  res.setHeader('Content-Type', 'text/html')
  res.send(ret)
})

app.get('/refresh', (req, res) => {
  refreshVersions(err => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  })
})

app.get('/remove', (req, res) => {
  let role = req.query.role
  store.removeIpAddressLease(role, (err) => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  });
})

app.get('/clear', (req, res) => {
  store.clear((err) => {
    if (err) throw err
    res.setHeader('Content-Type', 'text/plain')
    res.send('OK')
  });
})

app.use(express.static('static'))
refreshVersions( (err, version) => {
  if (err) throw err
  app.listen(port, () => {
    if (primary) {
      client.register(primary, 'MIRROR', true)
      console.log(`Registry Mirror listening on port ${port}`)
    } else {
      console.log(`Registry Primary listening on port ${port}`)
    }
  })
})
