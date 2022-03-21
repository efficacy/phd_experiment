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
        console.log(`Requester.call dest=${destination} action=${action} params=${params}`)
        if (!spec.caller) {
            callback(`unknown protocol: ${spec.protocol}`)
        }
        let url = `${spec.url}${action}?${params}`
        // console.log(`requester.call url=${url}`)
        spec.caller.get(url, (res) => {
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