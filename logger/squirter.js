const http = require('http')

let runs = 10000
let sofar = 0
let good = 0
let bad = 0
let start = Date.now()
http.get({
    hostname: 'localhost',
    port: 3002,
    path: `/setup?s=squirt`,
    agent: false
}, (res) => {
    for (let i = 0; i < runs; ++i) {
        http.get({
            hostname: 'localhost',
            port: 3002,
            path: `/log?t=${Date.now()}&v=4.9987&i=0.2356`,
            agent: false
        }, (res) => {
            ++sofar
            if (res.statusCode != 200) {
                ++bad
            } else {
                let body = ''
                res.on("data", function (chunk) {
                    body += chunk;
                })
                res.on("end", function (chunk) {
                    if (body == 'OK') {
                        ++good
                    } else {
                        ++bad
                    }
                    if (sofar >= runs) {
                        let end = Date.now()
                        let duration = end - start
                        console.log(`runs: ${runs} dur: ${duration}ms good: ${good} bad: ${bad}`)
                    }
                })
            }
        })
    }
})
