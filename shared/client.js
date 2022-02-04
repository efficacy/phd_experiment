const Config = require('./settings')
const Requester = require('./requester');
const Roles = require('./roles');

const Client = class {
    constructor(myrole, myhost) {
        this.config = new Config({role: myrole, host: myhost})
        this.roles = {}
        this.requester = new Requester(this.roles)
    }
    ensure(destination, callback) {
        let self = this
        if (!this.settings) {
            this.config.ensure((settings) => {
                self.roles[Roles.REGISTRY] = settings.registry
                self.settings = settings
                self.lookup(destination, self.settings, callback)
            })
        } else {
            self.lookup(destination, self.settings, callback)
        }
    }
    call(destination, action, params, callback) {
        this.requester.call(destination, action, params, (err, text, headers) => {
            callback(err, text, headers)
        })
    }
    lookup(destination, settings, callback) {
        if (this.roles[destination]) {
            return callback(null, settings)
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
                return callback(null, settings)
            }
            return callback(text)
        })
    }

    callRegistry(action, params, callback) {
        this.call(Roles.REGISTRY, action, params, callback)
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
    register(keepalive, callback) {
        let self = this
        this.ensure(Roles.REGISTRY, (err, settings)=>{
            if (err) {
                return callback(err)
            }
            let params = `role=${settings.role}&address=${settings.host}`
            this.callRegistry('register', params, (err, text, headers) => {
                let now = Date.now()
                if (err) {
                    return callback(err)
                }
                try {
                    let expiry_header = headers['x-lease-expiry']
                    let expiry = parseInt(expiry_header)
                    let lease = expiry - now
                    // console.log(`Client.register: got expiry header ${expiry_header} => ${expiry}  now=${now} duration=${expiry-now}`)
                    let config = JSON.parse(text)
                    if (keepalive) {
                        if (config) {
                            let host = config.server
                            this.config = config
                        }
                        setTimeout(() => {
                            return self.register(keepalive, callback)
                        }, lease - 10) // the 10 is a fiddle factor to make sure it's renewed early
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

    deregister(callback) {
        let self = this
        this.ensure(Roles.REGISTRY, (err, settings)=>{
            if (err) {
                return callback(err)
            }
            let params = `role=${settings.role}&address=${settings.host}`
            this.callRegistry('deregister', params, (err, text, headers) => {
                if (err) {
                    return callback(err)
                }
                callback(null, 'OK')
            })
        })
    }

    callLogger(action, params, callback) {
        this.call(Roles.LOG, action, params, callback)
    }
    
}

module.exports = Client