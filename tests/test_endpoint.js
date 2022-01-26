const test = require('tape')
const Endpoint = require('../shared/endpoint.js')

test('empty constructor', (t) => {
    let e = new Endpoint()
    t.equal(e.defaults.protocol, 'http', 'default default protocol')
    t.end()
})

test('specify default protocol', (t) => {
    let e = new Endpoint({protocol: 'https'})
    t.equal(e.defaults.protocol, 'https', 'specify default protocol')
    t.end()
})

test('all defaults', (t) => {
    let e = new Endpoint()
    t.equal(e.toURL(''), 'http://localhost:80/', 'all default defaults')
    t.end()
})

test('ip address', (t) => {
    let e = new Endpoint()
    t.equal(e.toURL('1.2.3.4'), 'http://1.2.3.4:80/', 'ip address as host')
    t.end()
})

test('ip address with port', (t) => {
    let e = new Endpoint()
    t.equal(e.toURL('1.2.3.4:995'), 'http://1.2.3.4:995/', 'ip address with port')
    t.end()
})

test('ip address with protocol and port', (t) => {
    let e = new Endpoint()
    t.equal(e.toURL('banana://1.2.3.4:995'), 'banana://1.2.3.4:995/', 'ip address with protocol and port')
    t.end()
})

test('hostname', (t) => {
    let e = new Endpoint()
    t.equal(e.toURL('uos.ac.uk'), 'http://uos.ac.uk:80/', 'domain name as host')
    t.end()
})

test('unrecognised role', (t) => {
    let e = new Endpoint()
    t.equal(e.toURL('logger'), 'http://localhost:80/', 'unrecognised role')
    t.end()
})

test('recognised role', (t) => {
    let e = new Endpoint().setRoles({logger: '1.2.3.4'})
    t.equal(e.toURL('logger'), 'http://1.2.3.4:80/', 'recognised role')
    t.end()
})
