const fs = require('fs')
const MemoryStore = require('./memory')

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

function getfs(rootDir, accept, cb) {
  fs.readdir(rootDir, function (err, files) {
    if (err) throw err
    let dirs = []
    for (var index = 0; index < files.length; ++index) {
      let file = files[index]
      if (file[0] !== '.') {
        let filePath = rootDir + '/' + file;
        fs.stat(filePath, function (err, stat) {
          if (accept(stat)) {
            dirs.push(this.file)
          }
          if (files.length === (this.index + 1)) {
            return cb(dirs)
          }
        }.bind({
          index: index,
          file: file
        }))
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

const Store = class {
  constructor(filename) {
    this.filename = filename
    this.cache = new MemoryStore()
    this.loaded = false
  }
  addIpAddressLease(role, address, when) {
    this.fetch()
    this.cache.addIpAddressLease(role, address, when)
    this.flush()
  }
  removeIpAddressLease(role, callback) {
    this.fetch()
    this.cache.removeIpAddressLease(role, (err) => {
      this.flush()
      return callback(err)
    })
  }
  getAddress(role, when) {
    this.fetch()
    return this.cache.getAddress(role, when)
  }
  each(fn) {
    this.fetch()
    this.cache.each(fn)
  }
  setLeaseDurationInMillis(duration) {
    this.cache.setLeaseDurationInMillis(duration)
  }
  getLeaseDurationInMillis(role) {
    this.fetch()
    return this.cache.getLeaseDurationInMillis(role)
  }
  reap(when) {
    this.fetch()
    this.cache.reap(when)
    this.flush()
  }

  fetch() {
    if (this.loaded) return
    if (!fs.existsSync(this.filename)) return
    fs.readFileSync(this.filename, 'utf-8').split(/\r?\n/).forEach((line) => {
      if (line.trim().length > 0) {
        var parts = line.split(',')
        this.cache.addIpAddressLease(parts[0], parts[1], parseInt(parts[2]))
      }
    })
    this.loaded = true
  }
  flush() {
    var buf = ''
    this.cache.each((lease) => {
      buf += `${lease.role},${lease.address},${lease.when}\n`
    })
    fs.writeFileSync(this.filename, buf)
  }
  clear(callback) {
    this.fetch()
    return fs.unlink(this.filename, (err) => {
      if (err instanceof Error && err.code == 'ENOENT') err = null
      this.cache.clear(() => {
        return callback(err)
      })
    })
  }

  getVersion() {
    return cache.getVersion()
  }
  getVersionData() {
    return cache.getVersionData()
  }
  refreshVersions(callback) {
    let bestdir = null
    let version = 0
    let versionData = {}
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
          if (scripts.length == 0) {
            versionData['scripts'] = {}
            this.cache.setVersionData(version, versionData)
            callback(err, version)
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
                this.cache.setVersionData(version, versionData)
                callback(err, version)
              }
            })
          }
        })
      })
    })
  }
}
module.exports = Store