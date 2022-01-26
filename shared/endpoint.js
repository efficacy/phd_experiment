const https = require('https')
const http = require('http')

const Endpoint = class {
    constructor(defaults) {
        this.defaults = defaults || {}
        this.defaults.protocol = this.defaults.protocol || 'http'
        this.defaults.port = this.defaults.port || 80
        this.defaults.host = this.defaults.host || 'localhost'
        this.roles = {}
        return this
    }

    setRoles(roles) {
        this.roles = roles || {}
        console.log(`endpoint setLookup: lookup= ${JSON.stringify(this.roles)}`)
        return this
    }

    findRole(role) {
        let ret = this.roles[role]
        console.log(`find role ${role} => ${ret}`)
        return ret
    }

    applyDefaults(spec) {
        spec.protocol = spec.protocol || this.defaults.protocol
        spec.host = spec.host || this.defaults.host
        spec.port = spec.port || this.defaults.port
        return spec
    }

    parse(s) {
        let spec = {}
 
        // protocol
        let match = s.match(/^([a-z0-9]+):\/\//)
        if (match) {
            console.log(`protocol match: [${match}]`)
            spec.protocol = match[1]
            s = s.substring(match[0].length)
        }
        
        // ip address
        match = s.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)
        if (match) {
            console.log(`ip match: [${match}]`)
            spec.host = match[0]
            s = s.substring(match[0].length)
        } else {
            // domain name
            match = s.match(/^[A-Za-z][A-Za-z0-9.]+/)
            if (match) {
                console.log(`hostname match: [${match}]`)
                spec.host = match[0]
                s = s.substring(match[0].length)
            }
        }
        // port
        match = s.match(/^:([0-9]+)/)
        if (match) {
            console.log(`port match: [${match}]`)
            spec.port = match[1]
            s = s.substring(match[0].length)
        }

        return spec
    }

    fill(spec) {
        return this.applyDefaults(spec)
    }

    expand(s) {
        let spec = s
        if (typeof s == 'string') {
            spec = this.parse(s)
        }
        if (spec.expanded) {
            return spec
        }

        spec = this.fill(spec)

        let host = spec.host
        if (host != 'localhost') {
            let match = host.match(/^[A-Za-z][A-Za-z0-9]+$/)
            if (match) {
                let role = match[0]
                spec.host = this.findRole(role)
                console.log(`host is a role: ${host}=>${spec.host}`)
                spec = this.applyDefaults(spec)
            }
        }

        if (spec.protocol == 'http' || !spec.protocol) {
            spec.caller = http
        } else if (spec.protocol == 'https') {
            spec.caller = https
        }

        spec.url = `${spec.protocol}://${spec.host}:${spec.port}/`
        spec.expanded = true
        return spec
    }

    toURL(s) {
        let spec = this.expand(s)
        return spec.url
    }
}

module.exports = Endpoint
