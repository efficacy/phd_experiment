const Pool = require('pg').Pool

const CREATE_TABLE =
  `
DROP TABLE IF EXISTS log;
CREATE TABLE log (
    t timestamptz,
    v double precision,
    i double precision,
    PRIMARY KEY(t)
);
DROP TABLE IF EXISTS session;
CREATE TABLE session (
    scenario varchar(32),
    session varchar(32),
    start timestamptz,
    stop timestamptz,
    PRIMARY KEY(scenario,session)
);
DROP TABLE IF EXISTS session2;
CREATE TABLE session2 (
    scenario varchar(32),
    session varchar(32),
    status char,
    start timestamp with time zone,
    stop timestamp with time zone,
    base_start timestamp with time zone,
    base_stop timestamp with time zone,
    avg_baseline decimal,
    avg_active decimal,
    total_active decimal,
    extra_active decimal,
    description text,
    PRIMARY KEY(scenario,session)
);

GRANT ALL ON log TO logger;
GRANT ALL ON session TO logger;
GRANT ALL ON session2 TO logger;
`

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
  append(voltage, current, callback) {
    // console.log(`pg append v=${voltage} i=${current}`)
    this.pool.query('INSERT INTO log (t,v,i) values (localtimestamp,$1,$2)', [voltage, current], handle(callback))
  }
  setup(scenario, session, description, callback) {
    // console.log(`pg start scenario=${scenario} session=${session} desc=${description}`)
    this.state.scenario = scenario
    this.state.session = session
    this.state.active = 'Y'
    this.pool.query(`INSERT INTO session2 (scenario,session,status,description) values ($1,$2,'Y',$3)`, [scenario, session, description], handle(callback))
  }
  bstart(callback) {
    // console.log(`pg bstart`)
    let scenario = this.state.scenario
    let session = this.state.session
    this.pool.query('UPDATE session2 SET base_start=localtimestamp WHERE scenario=$1 AND session=$2', [scenario, session], handle(callback))
  }
  bstop(callback) {
    // console.log(`pg bstop`)
    let scenario = this.state.scenario
    let session = this.state.session
    this.pool.query('UPDATE session2 SET base_stop=localtimestamp WHERE scenario=$1 AND session=$2', [scenario, session], handle(callback))
  }
  mstart(callback) {
    // console.log(`pg mstart`)
    let scenario = this.state.scenario
    let session = this.state.session
    this.pool.query('UPDATE session2 SET start=localtimestamp WHERE scenario=$1 AND session=$2', [scenario, session], handle(callback))
  }
  mstop(callback) {
    // console.log(`pg mstop`)
    let scenario = this.state.scenario
    let session = this.state.session
    this.pool.query('UPDATE session2 SET stop=localtimestamp WHERE scenario=$1 AND session=$2', [scenario, session], handle(callback))
  }
  terminate(callback) {
    // console.log(`pg terminate`)
    let scenario = this.state.scenario
    let session = this.state.session
    this.state.active = 'N'
    this.pool.query(`UPDATE session2 SET status='N' where scenario=$1 and session=$2`, [scenario, session], handle(callback))
    //TODO calculate derived values
  }
  status(callback) {
    let self = this
    this.pool.query("SELECT count(*) FROM log AS count", (error, results) => {
      if (callback) {
        if (error) {
          callback(error)
        } else {
          let count = results.rows[0].count
          callback(null, self.state.scenario, self.state.session, self.state.active, count)
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
