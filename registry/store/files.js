const fs = require('fs')
const async = require('async')
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

const FileStore = class {
  constructor(filename) {
    this.filename = filename
    this.cache = new MemoryStore()
    this.loaded = false
  }
  static create(filename) {
    return new FileStore(filename || 'leases.txt')
  }

  addIpAddressLease(role, address, when, callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      this.cache.addIpAddressLease(role, address, when, (err) => {
        this.flush(callback)
      })
    })
  }

  endIpAddressLease(role, address, callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      this.cache.endIpAddressLease(role, address, (err) => {
        this.flush(callback)
      })
    })
  }

  removeIpAddressLease(role, address, callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      this.cache.removeIpAddressLease(role, address, (err) => {
        this.flush(callback)
      })
    })
  }

  getAddress(role, when, callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      this.cache.getAddress(role, when, callback)
    })
  }

  each(fn, callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      this.cache.each(fn, callback)
    })
  }

  reap(when, callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      this.cache.reap(when, (err) => {
        this.flush()
        return callback(err)
      })
    })
  }

  parse(content, callback) {
    async.each(content.split(/\r?\n/), (line, step) => {
      if (line.trim().length > 0) {
        let parts = line.split(',')
        let role = parts[0]
        let address = parts[1]
        let when = parseInt(parts[2])
        // console.log(`loading lease role:${role} address:${address} when:${when}`)
        this.cache.addIpAddressLease(role, address, when, step)
      } else {
        return step()
      }
    }, (err) => {
      this.loaded = true
      return callback(err)
    })
  }

  fetch(callback) {
    if (this.loaded) return callback()
    if (!fs.existsSync(this.filename)) {
      this.parse('', callback)
    } else {
      fs.readFile(this.filename, 'utf8', (err, content) => {
        if (err) return callback(err)
        this.parse(content, callback)
      })
    }
  }

  flush(callback) {
    let self = this
    var buf = ''
    async.each(this.cache.leases, (lease, step) => {
      console.log(`saving lease ${JSON.stringify(lease)}`)
      buf += `${lease.role},${lease.address},${lease.when}\n`
      return step()
    }, () => {
      fs.writeFile(self.filename, buf, ()=> {
        return callback()
      })
    })
  }

  clear(callback) {
    let self = this
    this.fetch((err) => {
      if (err) return callback(err)
      return fs.unlink(self.filename, (err) => {
        if (err instanceof Error && err.code == 'ENOENT') err = null
        self.cache.clear(callback)
      })
    })
  }

  getVersion(callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      return this.cache.getVersion(callback)
    })
  }

  getVersionData(callback) {
    this.fetch((err) => {
      if (err) return callback(err)
      return this.cache.getVersionData(callback)
    })
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
      console.log(`* serving version ${version}`)

      fileContents('versions/' + bestdir + '/config.json', (err, s) => {
        if (!err) {
          versionData['config'] = JSON.parse(s)
        }
        let scripts = {}
        getfiles('versions/' + bestdir + '/scripts', scripts => {
          if (scripts.length == 0) {
            versionData['scripts'] = {}
            this.cache.setVersionData(version, versionData, (err) => {
              callback(err, version)
            })
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
                this.cache.setVersionData(version, versionData, (err) => {
                  callback(err, version)
                })
              }
            })
          }
        })
      })
    })
  }

  close(callback) {
    if (this.cache) {
      this.cache.close(() => {
        return callback()
      })
    } else {
      return callback()
    }
  }
}
module.exports = FileStore