const Pool = require('pg').Pool
const pool = new Pool({
    user: 'logger',
    host: 'localhost',
    database: 'experiments',
    password: 'logger',
    port: 5432,
})
module.exports = {
    _session: '?',
    setup: function (name) {
        this._session = name
    },
    start: function (callback) {
        if (callback) callback('OK');
    },
    append: function (stamp, voltage, current, callback) {
        pool.query('INSERT INTO log (s,t,v,i) values ($1,$2,$3,$4)', [this._session, stamp, voltage, current],
            function (error, results) {
                if (error) throw error;
                console.log(`insert ${stamp}: v=${voltage} i=${current}`)
                if (callback) {
                    callback('OK')
                }
            })
    },
    stop: function (callback) {
        if (callback) callback('OK');
    },
    rebuild: function (callback) {
        pool.query("DROP TABLE IF EXISTS log",
            function (error, results, fields) {
                if (error) throw error;
                pool.query("CREATE TABLE log ( s varchar(32), t bigint, v double precision, i double precision )",
                    function (error, results, fields) {
                        if (error) throw error;
                        if (callback) {
                            callback('OK')
                        }
                    })
            })
    }
}