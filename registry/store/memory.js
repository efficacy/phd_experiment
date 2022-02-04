const MemoryStore = class {
  constructor() {
    this.leases = {}
    this.version = 0
    this.versionData = {
      0: {
        scripts: {
          "DUT.sh": "echo DUT level 0",
          "LOAD.sh": "echo LOAD level 0",
          "TEST.sh": "echo TEST level 0"
        },
        config: {
          "version": 0,
          "server": "phd.eu.openode.io"
        }
      }
    }
  }

  static create() {
    return new MemoryStore()
  }
  
  addIpAddressLease(role, address, when, callback) {
    this.leases[role] = {
      role: role,
      address: address,
      when: when,
      status: 'ACTIVE'
    }
    return callback()
  }

  endIpAddressLease(role, address, callback) {
    //TODO support multiple addresses for a single role
    if (role in this.leases) {
      this.leases[role].status = 'ENDED'
      return callback()
    } else {
      return callback('No registration for ${role}')
    }
  }

  getAddress(role, when, callback) {
    when = when || Date.now()
    var lease = this.leases[role]
    return callback(null, (!lease || lease.when < when) ? null : lease.address)
  }
  each(fn, callback) {
    Object.entries(this.leases).forEach((pair) => {
      let value = pair[1]
      fn(value)
    })
    return callback()
  }
  reap(when, callback) {
    var active = {}
    Object.entries(this.leases).forEach((pair) => {
      let key = pair[0]
      let value = pair[1]
      if (value.when < when) {
        active[key] = value
      }
    })
    this.leases = active
    return callback()
  }
  clear(callback) {
    this.leases = {}
    return callback()
  }

  getVersion(callback) {
    return callback(null, this.version)
  }
  getVersionData(callback) {
    return callback(null, this.versionData)
  }
  refreshVersions(callback) {
    callback(null, this.version)
  }
  setVersionData(version, versionData, callback) {
    this.version = version
    this.versionData = versionData
    return callback()
  }
  close(callback) {
    return callback()
  }
}
module.exports = MemoryStore