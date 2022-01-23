const net = require('net');
const Settings = require('./settings')
const Resolver = require('./resolver')

const Client = class {
    constructor(role, port) {
        this._settings = new Settings(role, port)
        this.config = { addresses: {} }
        this.resolver = new Resolver(this._lookup)
        this.resolved = {}
    }
    ensure(callback) {
        this._settings.ensure(callback)
    }
    call(action, params, callback) {
        this.ensure((settings)=>{
            let host = settings.registry
            console.log(`about to call host=${host}`)
            if (host in this.resolved) {
                console.log(`host is already resolved`)
                return this._get(this.resolved[host].host, this.resolved[host].protocol, action, params, callback)
            }
            console.log(`host is not already resolved`)
            this.resolver.resolve(host, (err, host, protocol) => {
                console.log(`resolved -> host=${host} protocol=${protocol}`)
                if (err) throw err
                this.resolved[host] = { host: host, protocol: protocol }
                return this._get(host, protocol, action, params, callback)
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
    _get(host, protocol, action, params, callback) {
        console.log(`get(${host},${protocol},${action},${params},${callback})`)
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
    }
    _lookup(role, callback) {
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
    }
    register(role, keepalive, callback) {
        console.log(`register(${role}, ${keepalive}, ${callback})`)
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
                }
            })
        })
    }
}

module.exports = Client