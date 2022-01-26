const test = require('tape')
const registry = require('../registry/registry.js')
const Client = require('../shared/client.js')
const MemoryStore = require('../registry/store/memory.js')
const Requester = require('../shared/requester.js')

let store = new MemoryStore()
const dfl_port = 9999
let service = null

let roles = {
    registry: 'localhost'
}

function start_registry(port, cb) {
    registry.init(store, (err, app, _settings) => {
        if (err) throw err
        service = app.listen(port, () => {
            console.log(`Test Registry listening on http://localhost:${port}`)
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
    if (null != service) {
        return callback(null, new Requester(roles, {port: dfl_port}))
    } else {
        start_registry(port, () => {
            callback(null, new Requester(roles, {port: dfl_port}))
        })
    }
}

test('request to url', (t) => {
    ensure(dfl_port, (err, requester) => {
        requester.call(`http://localhost:${dfl_port}`, 'selfcheck', '', (err, headers, text) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('request to decomposed spec', (t) => {
    ensure(dfl_port, (err, requester) => {
        requester.call({host: 'localhost', port: dfl_port}, 'selfcheck', '', (err, headers, text) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('request to default port', (t) => {
    ensure(dfl_port, (err, requester) => {
        requester.call({host: 'localhost'}, 'selfcheck', '', (err, headers, text) => {
            t.error(err, 'no error from selfcheck')
            t.equal(text, 'OK', 'correct response')
            t.end()
        })
    })
})

test('request to a role', (t) => {
    ensure(dfl_port, (err, requester) => {
        requester.call({host: 'registry'}, 'selfcheck', '', (err, headers, text) => {
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
