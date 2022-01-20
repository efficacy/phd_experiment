const Pool = require('pg').Pool
const pool = new Pool({
    user: 'logger',
    host: 'localhost',
    database: 'experiments',
    password: 'logger',
    port: 5432,
})
var state = {
    session: 'None'
}
module.exports = {
    setup: function (name, callback) {
        state.session = name
        if (callback) callback(`OK: ${state.session}`);
    },
    start: function (callback) {
        if (callback) callback('OK');
    },
    append: function (stamp, voltage, current, callback) {
        pool.query('INSERT INTO log (s,t,v,i) values ($1,$2,$3,$4)', [state.session, stamp, voltage, current],
            function (error, results) {
                if (callback) {
                    if (error) {
                        callback(error)
                    } else {
                        callback('OK')
                    }
                } else if (error) {
                    throw error
                }
            })
    },
    stop: function (callback) {
        if (callback) callback('OK');
    },
    status: function (callback) {
        pool.query("SELECT count(*) FROM log AS count",
            function (error, results) {
                if (callback) {
                    if (error) {
                        callback(error)
                    } else {
                        let count = results.rows[0].count
                        callback(null, state.session, count)
                    }
                } else if (error) {
                    throw error
                }
            })
    },
    truncate: function (callback) {
        pool.query("TRUNCATE log",
            function (error, results) {
                if (callback) {
                    if (error) {
                        callback(error)
                    } else {
                        callback('OK')
                    }
                } else if (error) {
                    throw error
                }
            })
    },
    rebuild: function (callback) {
        pool.query("DROP TABLE IF EXISTS log",
            function (error, results, fields) {
                if (error) throw error
                pool.query("CREATE TABLE log ( s varchar(32), t bigint, v double precision, i double precision )",
                    function (error, results) {
                        if (callback) {
                            if (error) {
                                callback(error)
                            } else {
                                callback('OK')
                            }
                        } else if (error) {
                            throw error
                        }
                    })
            })
    }
}