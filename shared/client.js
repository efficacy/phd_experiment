const Config = require('./settings')
const Requester = require('./requester');
const Roles = require('./roles');

const Client = class {
    constructor(myrole, myport) {
        this.config = new Config({role: myrole, port: myport})
        this.roles = {}
        this.requester = new Requester(this.roles)
    }
    ensure(destination, callback) {
        let self = this
        if (!this.settings) {
            this.config.ensure((settings) => {
                self.roles[Roles.REGISTRY] = settings.registry
                self.settings = settings
                self.lookup(destination, callback)
            })
        } else {
            self.lookup(destination, callback)
        }
    }
    lookup(destination, callback) {
        if (this.roles[destination]) {
            return callback(null, this.settings)
        }
        if (!this.roles[Roles.REGISTRY]) {
            return callback(`unable to find Registry to lookup role ${destination}`)
        }
        this.requester.call(Roles.REGISTRY, 'lookup', `role=${destination}`, (err, text) => {
            if (err) {
                return callback(err)
            }
            if (text.startsWith('OK ')) {
                let host = text.substring(3)
                this.roles[destination] = host
                return callback(null, host)
            }
            return callback(text)
        })
    }
    callRegistry(action, params, callback) {
        this.requester.call(Roles.REGISTRY, action, params, (err, text, headers) => {
            callback(err, text, headers)
        })
    }
    check(callback) {
        this.ensure(Roles.REGISTRY, (err, settings)=>{
            if (err) {
                return callback(err)
            }
            this.callRegistry('selfcheck', '', (err, text, headers) => {
                callback(err, text)
            })
        })
    }
    register(role, keepalive, callback) {
        this.ensure(Roles.REGISTRY, (err, settings)=>{
            if (err) {
                return callback(err)
            }
            this.callRegistry('register', `role=${role}&address=${this.settings.host}:${this.settings.port}`, (err, text, headers) => {
                if (err) {
                    return callback(err)
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