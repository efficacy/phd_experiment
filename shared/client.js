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
        console.log(`client ensure dest=${destination} settings=${this.settings}`)
        if (!this.settings) {
            this.config.ensure((settings) => {
                self.roles[Roles.REGISTRY] = settings.registry
                console.log(`added registry from settings. roles=${JSON.stringify(self.roles)}`)
                self.settings = settings
                console.log(`client ensure after config.emsure, settings=${JSON.stringify(self.settings)}`)
                console.log(`client.ensure about to lookup with fresh settings`)
                self.lookup(destination, callback)
            })
        } else {
            console.log(`client.ensure about to lookup with existing settings`)
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
                this.roles[destination] = text.substring(3)
                return callback(null, settings)
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
                    console.log(`client.register returning error ${err}`)
                    return callback(err)
                }
                try {
                    console.log(`client.register receieved config ${text}`)
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