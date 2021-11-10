const net = require('net');
const Resolver = require('./resolver')

const Client = class {
    constructor(beacon, myport) {
        this.beacon = beacon
        this.myport = myport
        this.config = {}
        this.resolver = new Resolver(this.lookup)
        this.resolved = {}
        const client = net.connect({
            port: 80,
            host: this.beacon
        }, () => {
            this.ip = client.localAddress
        })
    }
    getSelf() {
        return `${this.ip}:${this.myport}`
    }
    get(host, protocol, action, params, callback) {
        protocol.get(`${host}${action}?${params}`, (res) => {
            let text = ''
            res.on('data', d => {
                text += d
            })
            res.on('end', () => {
                callback(null, res.headers, text)
            })
        }).on("error", (err) => {
            callback(err)
        });
    }
    call(host, action, params, callback) {
        if (host in this.resolved) {
            return this.get(this.resolved[host].host, this.resolved[host].protocol, action, params, callback)
        }
        this.resolver.resolve(host, (err, host, protocol) => {
            if (err) throw err
            this.resolved[host] = { host: host, protocol: protocol }
            return this.get(host, protocol, action, params, callback)
        })
    }
    selfcheck(host, callback) {
        this.call(host, 'selfcheck', '', (err, headers, text) => {
            callback(err, text)
        })
    }
    lookup(host, role, callback) {
        if (!this.config) {
            return callback('registration config missing')
        }
        if (role in this.config.addresses) {
            return callback(null, this.config.addresses[role])
        }
        this.call(host, 'lookup', `role=${role}`, (err, headers, text) => {
            if (err) {
                return callback(err)
            }
            if (text.startsWith('OK ')) {
                return callback(null, text.substring(3))
            }
            callback(text)
        })
    }
    register(host, role, keepalive) {
        this.call(host, 'register', `address=${this.ip}:${this.myport}`, (err, headers, text) => {
            if (err) throw (err)
            let expiry = parseInt(headers['x-lease-expiry'])
            if (keepalive) {
                try {
                    let config = JSON.parse(text)
                    if (config) {
                        host = config.server
                        this.config = config
                    }
                    let now = Date.now()
                    let lease = expiry - now - 10;
                    console.log(`got lease of ${lease} ms for host ${host}`)
                    setTimeout(() => {
                        return this.register(host, role, keepalive)
                    }, lease)
                } catch(err) {
                    console.log(`error: ${err}\ntext: ${text}`)
                }
            }
        })
    }
}

module.exports = Client