const fs = require('fs')
const os = require('os')

const FileLogStore = class {
    constructor(filename) {
        this.filename = filename

        // TODO ensure output file
        this.state = {
            session: 'None'
        }
    }
    static create(filename) {
        return new FileLogStore(filename || 'log.csv')
    }
    setup(name, callback) {
        this.state.session = name
        if (callback) callback(null, `${this.state.session}`)
    }
    start(callback) {
        if (callback) callback();
    }
    append(stamp, voltage, current, callback) {
        fs.writeFile(this.filename, `${this.state.session},${stamp},${voltage},${current}${os.EOL}`, ()=> {
            if (callback) callback()
        })
    }
    stop(callback) {
        // do nothing in this case
        if (callback) callback();
    }
    status(callback) {
        // TODO give back number of logged records
        if (callback) callback(null, 0)
    }
    truncate(callback) {
        // TODO remove/recreate output file
        if (callback) callback()
    }
    rebuild(callback) {
        // TODO remove/recreate output file
        if (callback) callback()
    }
}
module.exports = FileLogStore
