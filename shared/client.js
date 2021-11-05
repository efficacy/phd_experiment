const net = require('net');
const {Resolver} = require('./util')

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
        // TODO if not found locally, ask the registry
    }
}

module.exports = Client