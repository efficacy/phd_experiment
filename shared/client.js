const net = require('net');
const https = require('https')
const http = require('http')

const Client = class {
    constructor(beacon, myport) {
        this.beacon = beacon
        this.myport = myport
        this.config = {}
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
    }
    lookup(role, cb) {
        if (!this.config) {
            return cb('registration config missing')
        }
        if (role in this.config.addresses) {
            return cb(null, this.config.addresses[role])
        }
        // TODO if not found locally, ask the CS
    }
}

module.exports = Client