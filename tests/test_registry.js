const test = require('tape')
const registry = require('../registry/registry.js')
const Client = require('../shared/client.js')
const Config = require('../shared/settings.js')
const MemoryStore = require('../registry/store/memory.js')

let store = new MemoryStore()

let services = {}
let settings = null
let registry_url = null

function start_registry(port, cb) {
    process.env.REGISTRY = `localhost:${port}`
    console.log(`start registry port=${port} store=${store.constructor.name}`)
    registry.init(store, port, (err, app, settings) => {
        if (err) throw err
        let service = app.listen(port, () => {
            console.log(`Test Registry listening on http://${settings.address}:${settings.port}`)
            return cb()
        })
        services[port] = service
    })
}

function stop_registry(cb) {
    service.close(() => {
        service = null
        registry_port = null
        cb()
    })
}

function ensure(port, callback) {
    let client = new Client('TEST', port)
    if (null != services[port]) {
        return callback(client)
    } else {
        start_registry(port, () => {
            callback(client)
        })
    }
}

test('registry is running', (t) => {
    ensure(9999, (client) => {
        client.check((err, text) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('register known role', (t) => {
    ensure(9999, (client) => {
        client.register('TEST', false, (err, expiry, config) => {
            console.log(`test register expiry=${expiry} config=${JSON.stringify(config)}`)
            t.error(err, 'no error from register')
            t.ok(expiry > 0)
            t.ok(config.addresses['TEST'].endsWith(':9999'), 'correct address')
            t.end()
        })
    })
})

test('register unknown role', (t) => {
    ensure(9998, (client) => {
        client.register('UGH', false, (err, expiry, config) => {
            // console.log(`test register expiry=${expiry} config=${JSON.stringify(config)}`)
            t.error(err, 'no error from register')
            t.ok(expiry > 0, 'expiry provided')
            t.ok(config.addresses['UGH'].endsWith(':9998'), 'correct address')
            t.end()
        })
    })
})

test('register and lookup role', (t) => {
    ensure(9999, (client1) => {
        client1.register('TEST1', false, (err, expiry, config) => {
            // console.log(`test register expiry=${expiry} config=${JSON.stringify(config)}`)
            t.error(err, 'no error from register 1')
            ensure(9998, (client2) => {
                client2.register('TEST2', false, (err, expiry, config) => {
                    t.error(err, 'no error from register 2')
                    client1.lookup('TEST2', (err, address) => {
                        t.error(err, 'no error from lookup')
                        t.ok(address.endsWith(':9998'), 'correct address')
                        t.end()
                    })
                })
            })
        })
    })
})

test.onFinish(() => {
    console.log('closing registry...')
    let entries = Object.entries(services)
    let n = entries.length
    for (const [key, value] of entries) {
        console.log(`stopping server on port ${key}`);
        stop_registry(() => {
            console.log('registry stopped')
            if (--n <= 0) {
                process.exit(0) // TODO this is a hack. Why does it hang unless I do this?
            }
        })
    }
      
})
