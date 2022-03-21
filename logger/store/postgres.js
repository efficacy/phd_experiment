const Pool = require('pg').Pool

const CREATE_TABLE =
`CREATE TABLE log (
    scenario varchar(32),
    session varchar(32),
    stamp datetime,
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
    setup(scenario, session, callback) {
        this.state.scenario = scenario
        this.state.session = session
        let tag = `${this.state.scenario}/${this.state.session}`
        console.log(`pg store, setting session to ${tag}`)
        if (callback) callback(null, tag)
    }
    start(callback) {
        if (callback) callback();
    }
    append(stamp, voltage, current, callback) {
        let tag = `${this.state.scenario}/${this.state.session}`
        this.pool.query('INSERT INTO log (s,t,v,i) values ($1,$2,$3,$4)', [tag, stamp, voltage, current],
            function (error, results) {
                if (callback) {
                    if (error) {
                        callback(error)
                    } else {
                        callback()
                    }
                } else if (error) {
                    throw error
                }
            })
    }
    stop(callback) {
        if (callback) callback();
    }
    status(callback) {
        let self = this
        this.pool.query("SELECT count(*) FROM log AS count",
            function (error, results) {
                if (callback) {
                    if (error) {
                        callback(error)
                    } else {
                        let count = results.rows[0].count
                        callback(null, self.state.session, count)
                    }
                } else if (error) {
                    throw error
                }
            })
    }
    truncate(callback) {
        this.pool.query("TRUNCATE log",
            function (error, results) {
                if (callback) {
                    callback(errpr)
                } else if (error) {
                    throw error
                }
            })
    }
    rebuild(callback) {
        this.pool.query("DROP TABLE IF EXISTS log",
            function (error, results, fields) {
                if (error) throw error
                this.pool.query(CREATE_TABLE,
                    function (error, results) {
                        if (callback) {
                            callback(error)
                        } else if (error) {
                            throw error
                        }
                    })
            })
    }
    close(callback) {
        this.pool.end(callback)
    }
}
module.exports = Store
