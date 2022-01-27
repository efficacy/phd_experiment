const test = require('tape')
const registry = require('../registry/registry.js')
const MemoryStore = require('../registry/store/memory.js')
const { Roles } = require('../shared/main.js')
const Requester = require('../shared/requester.js')

let store = new MemoryStore()
const dfl_port = 9991
let service = null

function start_registry(port, cb) {
    registry.init(store, port, (err, app, settings) => {
        if (err) throw err
        service = app.listen(settings.port, () => {
            console.log(`* Test Registry listening on http://${settings.host}:${settings.port}`)
            return cb(settings.port, service)
        })
    })
}

function stop_registry(port, cb) {
    service.close(() => {
        service = null
        cb(port)
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

function run(callback) {
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
            requester.call({ host: 'localhost', port: dfl_port }, 'selfcheck', '', (err, text, headers) => {
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
        console.log(`* stopping registry on port ${dfl_port}`);
        stop_registry(dfl_port, (port) => {
            console.log(`* registry stopped on part ${port}`)
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