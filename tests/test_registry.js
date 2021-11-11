const test = require('tape')
const server = require('../registry/server.js')
const Client = require('../shared/client.js')
const MemoryStore = require('../registry/store/memory.js')

const beacon = '192.168.1.1'
let store = new MemoryStore()

let registry_service = null
let registry_port = null

function start_registry(cb) {
    server.init(store, (err, app, port) => {
        if (err) throw err
        registry_service = app.listen(port, () => {
            registry_port = port
            console.log(`Test Registry listening on port ${port}`)
            return cb()
        })
    })
}

function ensure(port, callback) {
    let client = new Client(beacon, port)
    client.findIp(() => {
        if (null != registry_service) {
            return callback(client)
        } else {
            start_registry(() => {
                callback(client)
            })
        }
    })
}

function stop_registry(cb) {
    registry_service.close(() => {
        registry_service = null
        registry_port = null
        cb()
    })
}

test('registry is running', (t) => {
    ensure(9999, (client) => {
        client.selfcheck(`http://localhost:${registry_port}`, (err, text) => {
            t.error(err)
            t.equal(text, 'OK')
            t.end()
        })
    })
})

test('register known role', (t) => {
    ensure(9999, (client) => {
        client.register(`http://localhost:${registry_port}`, 'TEST', false, (err, expiry, config) => {
            // console.log(`test register expiry=${expiry} config=${JSON.stringify(config)}`)
            t.error(err)
            t.ok(expiry > 0)
            t.ok(config.addresses['TEST'].endsWith(':9999'))
            t.end()
        })
    })
})

test('register unknown role', (t) => {
    ensure(9998, (client) => {
        client.register(`http://localhost:${registry_port}`, 'UGH', false, (err, expiry, config) => {
            // console.log(`test register expiry=${expiry} config=${JSON.stringify(config)}`)
            t.error(err)
            t.ok(expiry > 0)
            t.ok(config.addresses['UGH'].endsWith(':9998'))
            t.end()
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
