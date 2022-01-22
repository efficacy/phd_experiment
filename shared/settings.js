const net = require('net');
const yargs = require('yargs')

function findIp(beacon, callback) {
    let client = net.connect({
        port: 80,
        host: beacon
    }, () => {
        let ip = client.localAddress
        console.log(`found ip address: ${ip}`)
        callback(ip)
    })
}

const Settings = class {
    constructor(dfl_role, dfl_port) {
        console.log(`settings constructor role=${dfl_role} port=${dfl_port}`)
        this.settings = {}

        let argv = yargs
            .option('address', {
                alias: 'a',
                description: 'IP address of this service',
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
                description: 'IP address to connect to to work out my IP address',
                type: 'string'
            })
            .help()
            .alias('help', 'h').argv

        this.settings.address = argv.address || process.env.ADDRESS
        this.settings.role = argv.role || process.env.ROLE || dfl_role
        this.settings.port = argv.port || process.env.PORT || dfl_port
        this.settings.registry = argv.registry || process.env.REGISTRY
        this.settings.beacon = argv.beacon || process.env.BEACON || '192.168.0.1'
        this.settings.args = argv._
    }
    init(callback) {
        this.initialised = true
        if (!this.settings.address) {
            findIp(this.settings.registry || this.settings.beacon, (ip) => {
                this.settings.address = ip
                console.log(`settings: ${JSON.stringify(this.settings)}`)
                callback(this.settings)
            })
        } else {
            console.log(`settings: ${JSON.stringify(this.settings)}`)
            callback(this.settings)
        }
    }
    ensure(callback) {
        if (this.initialised) {
            return callback(this.settings)
        }
        return this.init(callback)
    }
    getSelf() {
        return `${this.settings.address}:${this.settings.port}`
    }

}

module.exports = Settings
