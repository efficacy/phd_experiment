const net = require('net');

const Endpoint = require('./endpoint')

const Requester = class {
    constructor(roles, defaults) {
        this.roles = roles || {}
        this.endpoint = new Endpoint(defaults).setRoles(this.roles)
    }
    setRole(name, listener) {
        this.roles[name] = listener
    }
    call(destination, action, params, callback) {
        let spec = this.endpoint.expand(destination)
        // console.log(`Requester.call dest=${destination} spec=${JSON.stringify(spec)} action=${action} params=${params}`)
        if (!spec.caller) {
            callback(`unknown protocol: ${spec.protocol}`)
        }
        spec.caller.get(`${spec.url}${action}?${params}`, (res) => {
            let text = ''
            res.on('data', d => {
                text += d
            })
            res.on('end', () => {
                callback(null, text, res.headers)
            })
        }).on("error", (err) => {
            callback(err)
        })
    }
}

module.exports = Requester