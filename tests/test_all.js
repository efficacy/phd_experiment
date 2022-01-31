let async = require('async')

let tests = [
    require("./test_endpoint"),
    require("./test_requester"),
    require("./test_registry"),
    require("./test_logger")
]

async.each(tests, (t, done) => {
    t(done)
}, () => {
    console.log('all tests complete. closing...')
    process.exit(0)
})
