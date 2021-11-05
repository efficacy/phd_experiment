const https = require('https')
const http = require('http')

class Resolver {
    constructor(lookup) {
        this.lookup = lookup
    }
    resolve(host, cb) {
        if (host.startsWith('role://')) {
            let trimmed = host.substring(7)
            let prefix = 0
            let slash = trimmed.indexOf('/')
            if (-1 == slash) {
                slash = trimmed.length()
            }
            let role = trimmed.substring(prefix, slash)
            this.lookup(role, (err, address) => {
                if (err) {
                    return cb(err)
                }
                return this.resolve(address, cb)
            })
            return
        }
        let protocol = https
        if (!host.startsWith('http')) {
            host = 'https://' + host
        }
        if (host.startsWith('http://')) {
            protocol = http
        }
        if (!host.endsWith('/')) {
            host = host + '/'
        }
        cb(null, host, protocol)
    }
}

module.exports = {
    Resolver : Resolver
}
