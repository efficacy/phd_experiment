const net = require('net');
const Settings = require('./settings')
const Resolver = require('./resolver')

const Client = class {
    constructor(role, port) {
        this._settings = new Settings(role, port)
        this.config = { addresses: {} }
        this.resolver = new Resolver(this.lookup)
        this.resolved = {}
    }
    ensure(callback) {
        this._settings.ensure(callback)
    }
    getSelf(callback) {
        this.ensure((settings) => {
            callback(`${settings.address}:${settings.port}`)
        })
    }
    get(host, protocol, action, params, callback) {
        this.ensure((settings) => {
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
            })
        })
    }
    call(action, params, callback) {
        this.ensure((settings)=>{
            let host = settings.registry
            if (host in this.resolved) {
                return this.get(this.resolved[host].host, this.resolved[host].protocol, action, params, callback)
            }
            this.resolver.resolve(host, (err, host, protocol) => {
                if (err) throw err
                this.resolved[host] = { host: host, protocol: protocol }
                return this.get(host, protocol, action, params, callback)
            })
        })
    }
    selfcheck(callback) {
        this.ensure((settings)=>{
            this.call('selfcheck', '', (err, headers, text) => {
                callback(err, text)
            })
        })
    }
    lookup(role, callback) {
        this.ensure((settings)=>{
            if (!this.config) {
                return callback('registration config missing')
            }
            if (role in this.config.addresses) {
                return callback(null, this.config.addresses[role])
            }
            this.call('lookup', `role=${role}`, (err, headers, text) => {
                if (err) {
                    return callback(err)
                }
                if (text.startsWith('OK ')) {
                    return callback(null, text.substring(3))
                }
                callback(text)
            })
        })
    }
    register(role, keepalive, callback) {
        this.ensure((settings)=>{
            this.call('register', `role=${role}&address=${settings.address}:${settings.port}`, (err, headers, text) => {
                if (err) {
                    if (callback) {
                        return callback(err)
                    } else {
                        throw (err)
                    }
                }
                try {
                    let expiry = parseInt(headers['x-lease-expiry'])
                    let config = JSON.parse(text)
                    if (keepalive) {
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
                    }
                    if (callback) callback(null, expiry, config)
                } catch (err) {
                    if (callback) {
                        return callback(err)
                    } else {
                        throw (err)
                    }
                    console.log(`error: ${err}\ntext: ${text}`)
                }
            })
        })
    }
}

module.exports = Client