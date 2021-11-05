const fs = require('fs')
const MemoryStore = require('./memory')

const Store = class {
    constructor(filename) {
        this.filename = filename
        this.cache = null
    }
    addIpAddressLease(role,address,when) {
        this.fetch()
        this.cache.addIpAddressLease(role, address,when)
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
        if (this.cache) return
        this.cache = new MemoryStore()
        if (! fs.existsSync(this.filename)) return
        fs.readFileSync(this.filename, 'utf-8').split(/\r?\n/).forEach((line) => {
            if (line.trim().length > 0) {
                var parts = line.split(',')
                this.cache.addIpAddressLease(parts[0], parts[1], parseInt(parts[2]))
            }
        })
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
}
module.exports = Store