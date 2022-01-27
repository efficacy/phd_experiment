const test = require('tape')
const registry = require('../registry/registry.js')
const Client = require('../shared/client.js')
const Config = require('../shared/settings.js')
const MemoryStore = require('../registry/store/memory.js')

let store = new MemoryStore()
const dfl_port = 9997

let services = {}

function start_registry(port, cb) {
    process.env.REGISTRY = `localhost:${port}`
    console.log(`* start test registry port=${port} store=${store.constructor.name}`)
    registry.init(store, port, (err, app, settings) => {
        if (err) throw err
        let service = app.listen(port, () => {
            services[port] = service
            console.log(`* Test Registry listening on http://${settings.host}:${settings.port}`)
            return cb(port, service)
        })
    })
}

function stop_registry(port, service, cb) {
    service.close(() => {
        services[port] = null
        cb(port)
    })
}

function ensure(port, callback) {
    if (null != services[port]) {
        let client = new Client('TEST', port)
        return callback(client)
    } else {
        start_registry(port, (port, service) => {
            let client = new Client('TEST', port)
            callback(client)
        })
    }
}

test('registry is running', (t) => {
    ensure(dfl_port, (client) => {
        client.check((err, text) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('register known role', (t) => {
    ensure(dfl_port, (client) => {
        client.register('TEST', false, (err, expiry, config) => {
            t.error(err, 'no error from register')
            t.ok(expiry > 0)
            t.ok(config.addresses['TEST'].endsWith(`:${dfl_port}`), 'correct address')
            t.end()
        })
    })
})

test('register unknown role', (t) => {
    ensure(9998, (client) => {
        client.register('UGH', false, (err, expiry, config) => {
            t.error(err, 'no error from register')
            t.ok(expiry > 0, 'expiry provided')
            t.ok(config.addresses['UGH'].endsWith(':9998'), 'correct address')
            t.end()
        })
    })
})

test('register and lookup role', (t) => {
    ensure(dfl_port, (client1) => {
        client1.register('TEST1', false, (err, expiry, config) => {
            t.error(err, 'no error from register 1')
            ensure(9998, (client2) => {
                client2.register('TEST2', false, (err, expiry, config) => {
                    t.error(err, 'no error from register 2')
                    client1.lookup('TEST2', (err, host) => {
                        t.error(err, 'no error from lookup')
                        t.ok(host.endsWith(':9998'), 'correct address')
                        t.end()
                    })
                })
            })
        })
    })
})

test.onFinish(() => {
    let entries = Object.entries(services)
    let n = entries.length
    for (const [port, service] of entries) {
        console.log(`* stopping registry on port ${port}`);
        stop_registry(port, service, (port) => {
            console.log(`* registry stopped on part ${port}`)
            if (--n <= 0) {
                process.exit(0) // TODO this is a hack. Why does it hang unless I do this?
            }
        })
    }
      
})
