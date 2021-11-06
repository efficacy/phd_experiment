const test = require('tape')

const {Resolver} = require('../shared/resolver')

let addresses = {
    LOGGER: '1.2.3.56'
}
function lookup(role, cb) {
    if (role in addresses) {
        return cb(null, addresses[role])
    }
    return cb(`${role} not found`)
}

let resolver = new Resolver(lookup)

test('resolve explicit http', function (t) {
    resolver.resolve('http://google.com/', (err, url, protocol) => {
        t.equal(url, 'http://google.com/', 'url')
        t.equal(protocol.globalAgent.protocol, 'http:', 'protocol')
        t.end()
    })
})

test('resolve explicit https', function (t) {
    resolver.resolve('https://google.com/', (err, url, protocol) => {
        t.equal(url, 'https://google.com/', 'url')
        t.equal(protocol.globalAgent.protocol, 'https:', 'protocol')
        t.end()
    })
})

test('resolve implicit https', function (t) {
    resolver.resolve('1.2.3.56', (err, url, protocol) => {
        t.equal(url, 'https://1.2.3.56/', 'url')
        t.equal(protocol.globalAgent.protocol, 'https:', 'protocol')
        t.end()
    })
})

test('resolve implicit https with slash', function (t) {
    resolver.resolve('1.2.3.56/', (err, url, protocol) => {
        t.equal(url, 'https://1.2.3.56/', 'url')
        t.equal(protocol.globalAgent.protocol, 'https:', 'protocol')
        t.end()
    })
})

test('lookup known role', function (t) {
    resolver.resolve('role://LOGGER/', (err, url, protocol) => {
        t.equal(url, 'https://1.2.3.56/', 'url')
        t.equal(protocol.globalAgent.protocol, 'https:', 'protocol')
        t.end()
    })
})

test('lookup unknown role', function (t) {
    resolver.resolve('role://DUT/', (err, url, protocol) => {
        t.ok(err, 'error')
        t.end()
    })
})