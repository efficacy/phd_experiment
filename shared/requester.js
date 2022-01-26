const net = require('net');

const Endpoint = require('./endpoint')

const Requester = class {
    constructor(roles, defaults) {
        this.roles = roles || {}
        this.endpoint = new Endpoint(defaults).setRoles(this.roles)
        console.log(`Requester setup this=${this} roles=${this.roles}`)
    }
    setRole(name, address, port) {
        this.roles[name] = {address: address, port: port}
    }
    call(destination, action, params, callback) {
        let spec = this.endpoint.expand(destination)
        if (!spec.caller) {
            callback(`unknown protocol: ${spec.protocol}`)
        }
        spec.caller.get(`${spec.url}${action}?${params}`, (res) => {
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
}

module.exports = Requester