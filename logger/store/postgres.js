const Pool = require('pg').Pool

const CREATE_TABLE = 
`CREATE TABLE log (
    s varchar(32),
    t bigint,
    v double precision,
    i double precision
)`

const Store = class {
    constructor() {
        this.pool = new Pool({
            user: process.env.DBUSER || 'logger',
            host: process.env.DBHOST || 'localhost',
            database: process.env.DATABASE || 'experiments',
            password: process.env.DBPASSWORD || 'logger',
            port: process.env.DBPORT || 5432,
        })
        this.state = {
            session: 'None'
        }
    }
    static create(filename) {
        return new Store()
    }
    setup(name, callback) {
        this.state.session = name
        if (callback) callback(`OK: ${state.session}`)
    }
    start(callback) {
        if (callback) callback('OK');
    }
    append(stamp, voltage, current, callback) {
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
    }
    stop(callback) {
        if (callback) callback('OK');
    }
    status(callback) {
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
    }
    truncate(callback) {
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
    }
    rebuild(callback) {
        pool.query("DROP TABLE IF EXISTS log",
            function (error, results, fields) {
                if (error) throw error
                pool.query(CREATE_TABLE,
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
module.exports = Store
