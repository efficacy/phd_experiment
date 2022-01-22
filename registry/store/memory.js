const Store = class {
  constructor() {
    this.leases = {}
    this.duration = 5000
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
    return new Store()
  }
  addIpAddressLease(role, address, when, callback) {
    this.leases[role] = {
      role: role,
      address: address,
      when: when
    }
    return callback()
  }
  removeIpAddressLease(role, callback) {
    delete this.leases[role]
    return callback()
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
  setLeaseDurationInMillis(duration, callback) {
    this.duration = parseInt(duration)
    return callback()
  }
  getLeaseDurationInMillis(role, callback) {
    // MIRROR is a local server, and should be timed to minimise lease renewals
    // Others should be relatively quick, so they all register with the mirror if available
    let ret = this.duration
    if (role == 'MIRROR' || !('MIRROR' in this.leases)) {
      ret = 86400000
    }
    return callback(null, ret)
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
}
module.exports = Store