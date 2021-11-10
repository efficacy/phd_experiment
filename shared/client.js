const net = require('net');
const Resolver = require('./resolver')

const Client = class {
    constructor(beacon, myport) {
        this.beacon = beacon
        this.myport = myport
        this.config = {}
        this.resolver = new Resolver(this.lookup)
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
    register(host, role, keepalive) {
        this.resolver.resolve(host, (err, host, protocol) => {
            if (err) throw err
            console.log(`register ${role} with host ${host} keepalive=${keepalive} my ip=${this.ip} my port=${this.myport}`)
            this.resolved = { host: host, protocol: protocol }
            protocol.get(`${host}register?role=${role}&address=${this.ip}:${this.myport}`, (res) => {
                let expiry = parseInt(res.headers['x-lease-expiry'])
                if (keepalive) {
                    let text = ''
                    res.on('data', d => {
                        text += d
                    })
                    res.on('end', d => {
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
                    })
                }
            })
        })
    }
    lookup(role, cb) {
        if (!this.config) {
            return cb('registration config missing')
        }
        if (role in this.config.addresses) {
            return cb(null, this.config.addresses[role])
        }
        this.resolved.protocol.get(`${this.resolved.host}lookup?role=${role}`, (res) => {
            let text = ''
            res.on('data', d => {
                text += d
            })
            res.on('end', d => {
                if (text.startsWith('OK ')) {
                    return cb(null, text.substring(3))
                }
                cb(text)
            })
        })
    }
}

module.exports = Client