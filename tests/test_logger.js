const test = require('tape')
const logger = require('../logger/logger.js')
const Client = require('../shared/client.js')
const Config = require('../shared/settings.js')
const store = require('../logger/store/files.js').create()

const dfl_port = 9996
let service = null
let service_port = null

function start(port, cb) {
    console.log(`* start test logger port=${port} store=${store.constructor.name}`)
    logger.init(store, port, (err, app, settings) => {
        if (err) throw err
        service = app.listen(port, () => {
            service_port = port
            console.log(`* Test Logger listening on http://${settings.host}:${settings.port}`)
            return cb(port, service)
        })
    })
}

function stop(port, service, cb) {
    if (service) service.close(() => {
        service = null
        cb(port)
    })
}

function ensure(port, callback) {
    if (null != service) {
        let client = new Client('TEST', port)
        return callback(client)
    } else {
        start(port, (port, service) => {
            let client = new Client('TEST', port)
            callback(client)
        })
    }
}

function run(callback) {

    test('logger is running', (t) => {
        ensure(dfl_port, (client) => {
            client.call(`http://localhost:${service_port}`,'status','',(err, text) => {
                t.error(err, 'no error from status')
                let status = JSON.parse(text)
                t.assert('session' in status, 'status response has a session key')
                t.equals(status.session, 0, 'uninitialised session has id 0')
                t.end()
            })
        })
    })

    test.onFinish(() => {
        console.log(`* stopping logger on port ${service_port}`);
        stop(service_port, service, (port) => {
            console.log(`* logger stopped on part ${port}`)
            callback()
        })
    })
}

if (require.main === module) {
    run(() => {
        process.exit(0)
    })
}

module.exports = run