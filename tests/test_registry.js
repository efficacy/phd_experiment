const test = require('tape')
const server = require('../registry/server.js')
const Client = require('../shared/client.js')

let client = new Client('192.168.1.1', 9999)

let registry_service = null
let registry_port = null

function start_registry(cb) {
    server.bare((err, app, port) => {
        if (err) throw err
        registry_service = app.listen(port, () => {
            registry_port = port
            console.log(`Test Registry listening on port ${port}`)
            return cb()
        })
    })
}

function ensure(cb) {
    if (null != registry_service) {
        return cb()
    } else {
        start_registry(cb)
    }
}

function stop_registry(cb) {
    registry_service.close(() => {
        registry_service = null
        registry_port = null
        cb()
    })
}

test('registry is running', (t) => {
    ensure(() => {
        client.selfcheck(`http://localhost:${registry_port}`, (err, text) => {
            t.error(err)
            t.equal(text, 'OK')
            t.end()
        })
    })
})

test('register', (t) => {
    ensure(() => {
        client.register(`http://localhost:${registry_port}`, 'TEST', false, (err, expiry, config) => {
            console.log(`test register expiry=${expiry} config=${JSON.stringify(config)}`)
            t.error(err)
            t.ok(expiry > 0)
            t.end()
        })
    })
})

test.onFinish(() => {
    console.log('closing registry...')
    stop_registry(() => {
        console.log('registry stopped')
        // process.exit(0) // TODO this is a hack. Why does it hang unless I do this?
    })
})
