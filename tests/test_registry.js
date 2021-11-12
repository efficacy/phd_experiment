const test = require('tape')
const server = require('../registry/server.js')
const Client = require('../shared/client.js')
const MemoryStore = require('../registry/store/memory.js')

const beacon = '192.168.1.1'
let store = new MemoryStore()

let service = null
let registry_url = null

function start_registry(cb) {
    server.init(store, (err, app, port) => {
        if (err) throw err
        service = app.listen(port, () => {
            registry_url = `http://localhost:${port}`
            console.log(`Test Registry listening on port ${port}`)
            return cb()
        })
    })
}

function ensure(port, callback) {
    Client.findIp(beacon, () => {
        if (null != service) {
            return callback(new Client(port, registry_url))
        } else {
            start_registry(() => {
                callback(new Client(port, registry_url))
            })
        }
    })
}

function stop_registry(cb) {
    service.close(() => {
        service = null
        registry_port = null
        cb()
    })
}

test('registry is running', (t) => {
    ensure(9999, (client) => {
        client.selfcheck((err, text) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('register known role', (t) => {
    ensure(9999, (client) => {
        client.register('TEST', false, (err, expiry, config) => {
            // console.log(`test register expiry=${expiry} config=${JSON.stringify(config)}`)
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
    stop_registry(() => {
        console.log('registry stopped')
        process.exit(0) // TODO this is a hack. Why does it hang unless I do this?
    })
})
