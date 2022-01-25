function unknown(s) {
    return null
}

const Endpoint = class {
    constructor(defaults, lookup) {
        this.defaults = defaults || {}
        this.defaults.protocol = this.defaults.protocol || 'http'
        this.defaults.port = this.defaults.port || 80
        this.defaults.host = this.defaults.host || 'localhost'
        this.lookup = lookup || unknown
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
            console.log(`after protocol, s=${s}`)
        }
        
        // ip address
        match = s.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}/)
        if (match) {
            console.log(`ip match: [${match}]`)
            spec.host = match[0]
            s = s.substring(match[0].length)
            console.log(`after ip address, s=${s}`)
        } else {
            // domain name
            match = s.match(/^[A-Za-z][a-z0-9]+(\.[A-Za-z0-9]+)+/)
            if (match) {
                console.log(`hostname match: [${match}]`)
                spec.host = match[0]
                s = s.substring(match[0].length)
                console.log(`after hostmane, s=${s}`)
            } else {
                // role name
                match = s.match(/^[A-Za-z][a-z0-9]+/)
                if (match) {
                    console.log(`roleame match: [${match}]`)
                    let role = match[0]
                    spec.host = this.lookup(role)
                    s = s.substring(match[0].length)
                    console.log(`after rolemane, s=${s}`)
                }
            }
        }
        // port
        match = s.match(/^:([0-9]+)/)
        if (match) {
            console.log(`port match: [${match}]`)
            spec.port = match[1]
            s = s.substring(match[0].length)
            console.log(`after port, s=${s}`)
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
        return this.fill(spec)
    }

    toURL(s) {
        let spec = this.expand(s)
        return `${spec.protocol}://${spec.host}:${spec.port}/`
    }
}

module.exports = Endpoint
