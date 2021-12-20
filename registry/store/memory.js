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
  addIpAddressLease(role, address, when) {
    this.leases[role] = {
      role: role,
      address: address,
      when: when
    }
  }
  removeIpAddressLease(role, callback) {
    delete this.leases[role]
    return callback()
  }
  getAddress(role, when) {
    when = when || Date.now()
    var lease = this.leases[role]
    if (!lease || lease.when < when) return null
    return lease.address
  }
  each(fn) {
    Object.entries(this.leases).forEach((pair) => {
      let value = pair[1]
      fn(value)
    })
  }
  setLeaseDurationInMillis(duration) {
    this.duration = parseInt(duration)
    console.log(`new duration: ${this.duration}`)
  }
  getLeaseDurationInMillis(role) {
    // MIRROR is a local server, and should be timed to minimise lease renewals
    // Others should be relatively quick, so they all register with the mirror if available
    let ret = this.duration
    if (role == 'MIRROR' || !('MIRROR' in this.leases)) {
      ret = 86400000
    }
    return ret
  }
  reap(when) {
    var active = {}
    Object.entries(this.leases).forEach((pair) => {
      let key = pair[0]
      let value = pair[1]
      if (value.when < when) {
        active[key] = value
      }
    })
    this.leases = active
  }
  clear(callback) {
    this.leases = {}
    return callback()
  }

  getVersion() {
    return this.version
  }
  getVersionData() {
    return this.versionData
  }
  refreshVersions(callback) {
    callback(null, this.version)
  }
  setVersionData(version, versionData) {
    this.version = version
    this.versionData = versionData
  }
}
module.exports = Store