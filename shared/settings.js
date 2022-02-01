const net = require('net');
const yargs = require('yargs')

const Endpoint = require('./endpoint')
const endpoint = new Endpoint()

function findIp(beacon, callback) {
    let client = net.connect({
        port: 80,
        host: beacon
    }, () => {
        let ip = client.localAddress
        callback(ip)
    })
}

const Config = class {
    constructor(defaults) {
        defaults = defaults || {}
        this.settings = {}

        let argv = yargs
            .option('host', {
                alias: 'u',
                description: 'base URL (host with optional protocol and port) of this service',
                type: 'string'
            })
            .option('port', {
                alias: 'p',
                description: 'port of this service',
                type: 'string'
            })
            .option('role', {
                alias: 'r',
                description: 'role of this service',
                type: 'string'
            })
            .option('registry', {
                alias: 'c',
                description: 'URL of a central registry service to register with',
                type: 'string'
            })
            .option('beacon', {
                alias: 'b',
                description: 'host to connect to to work out my IP address',
                type: 'string'
            })
            .option('store', {
                alias: 's',
                description: 'type of store to use for persistence (memory,files,mysql,postgres)',
                type: 'string'
            })
            .help()
            .alias('help', 'h').argv

        this.settings.host = argv.host || process.env.host || defaults.host
        this.settings.port = argv.port || process.env.PORT || defaults.port
        this.settings.role = argv.role || process.env.ROLE || defaults.role
        this.settings.registry = argv.registry || process.env.REGISTRY || defaults.registry
        this.settings.beacon = argv.beacon || process.env.BEACON || defaults.beacon || '192.168.0.1'
        this.settings.store = argv.store || process.env.STORE || defaults.store
        this.settings.args = argv._
    }
    init(callback) {
        this.initialised = true
        if (!this.settings.host) {
            findIp(this.settings.beacon, (ip) => {
                this.settings.host = ip
                callback(this.settings)
            })
        } else {
            callback(this.settings)
        }
    }
    ensure(callback) {
        if (this.initialised) {
            return callback(this.settings)
        }
        return this.init(callback)
    }
    static toURL(settings) {
        // console.log(`Config.toURL settings=${JSON.stringify(settings)}`)
        return endpoint.toURL(settings)
    }
}

module.exports = Config
