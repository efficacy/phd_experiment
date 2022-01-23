var mysql      = require('mysql')
var connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'logger',
  password : 'logger',
  database : 'experiments'
})

module.exports = {
    _session: '?',
    setup: function(name) {
        this._session = name
    },
    start: function(callback) {
        connection.connect(callback);
    },
    append: function (stamp, voltage, current, callback) {
        connection.query('INSERT INTO log (s,t,v,i) values (?,?,?,?)', [this._session, stamp, voltage, current],
            function (error, results, fields) {
                if (error) throw error;
            }
        )
        console.log(`insert ${stamp}: v=${voltage} i=${current}`)
        if (callback) {
            callback('OK')
        }
    },
    stop: function(callback) {
        connection.end(callback);
    },
    rebuild: function(callback) {
        connection.query("DROP TABLE IF EXISTS log",
        function (error, results, fields) {
            if (error) throw error;
            connection.query("CREATE TABLE log ( s varchar(32), t bigint, v double, i double )",
            function (error, results, fields) {
                if (error) throw error;
                if (callback) {
                    callback('OK')
                }
            })
        })
    }
}