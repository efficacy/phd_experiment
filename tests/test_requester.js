const test = require('tape')
const registry = require('../registry/registry.js')
const MemoryStore = require('../registry/store/memory.js')
const { Roles } = require('../shared/main.js')
const Requester = require('../shared/requester.js')

let store = new MemoryStore()
const dfl_port = 9999
let service = null

function start_registry(port, cb) {
    registry.init(store, port, (err, app, settings) => {
        if (err) throw err
        service = app.listen(port, () => {
            console.log(`Test Registry listening on http://${settings.address}:${settings.port}`)
            return cb()
        })
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
    let requester = new Requester()
    requester.setRole(Roles.REGISTRY, `localhost:${dfl_port}`)
    if (null != service) {
        return callback(null, requester)
    } else {
        start_registry(port, () => {
            callback(null, requester)
        })
    }
}

test('request to url', (t) => {
    ensure(dfl_port, (err, requester) => {
        requester.call(`http://localhost:${dfl_port}`, 'selfcheck', '', (err, text, headers) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('request to decomposed spec', (t) => {
    ensure(dfl_port, (err, requester) => {
        requester.call({host: 'localhost', port: dfl_port}, 'selfcheck', '', (err, text, headers) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('request to a role', (t) => {
    ensure(dfl_port, (err, requester) => {
        requester.call(Roles.REGISTRY, 'selfcheck', '', (err, text, headers) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
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
