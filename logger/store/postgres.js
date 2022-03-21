const Pool = require('pg').Pool

const CREATE_TABLE =
`DROP TABLE IF EXISTS log;
CREATE TABLE log (
    t timestamp,
    v double precision,
    i double precision,
    PRIMARY KEY(t)
);
DROP TABLE IF EXISTS session;
CREATE TABLE session (
    scenario varchar(32),
    session varchar(32),
    start timestamp,
    stop timestamp,
    PRIMARY KEY(scenario,session)
);
GRANT ALL ON log TO logger;
GRANT ALL ON session TO logger;`

function handle(callback, message) {
    return function handle(error, results) {
        if (callback) {
            if (error) {
                console.log(`db: ${error}`)
                callback(error)
            } else {
                callback(message)
            }
        } else if (error) {
            throw error
        }
    }
}

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
    start(scenario, session, callback) {
        // console.log(`pg start scenario=${scenario} session=${session}`)
        this.state.scenario = scenario
        this.state.session = session
        this.pool.query('INSERT INTO session (scenario,session,start) values ($1,$2,localtimestamp)', [scenario, session], handle(callback))
    }
    stop(callback) {
        if (callback) callback();
    }
    append(voltage, current, callback) {
        // console.log(`pg append v=${voltage} i=${current}`)
        this.pool.query('INSERT INTO log (t,v,i) values (localtimestamp,$1,$2)', [voltage, current], handle(callback))
    }
    stop(callback) {
        // console.log(`pg stop`)
        let scenario = this.state.scenario
        let session = this.state.session
        this.pool.query('UPDATE session SET stop=localtimestamp WHERE scenario=$1 AND session=$2', [scenario, session], handle(callback))
    }
    status(callback) {
        let self = this
        this.pool.query("SELECT count(*) FROM log AS count", (error, results) => {
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
        this.pool.query("TRUNCATE log", (error) => {
            if (error) throw error
            this.pool.query("TRUNCATE sessions", handle(callback))
        })
    }
    rebuild(callback) {
        this.pool.query(CREATE_TABLE, handle(callback))
    }
    close(callback) {
        this.pool.end(callback)
    }
}
module.exports = Store
