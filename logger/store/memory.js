const Store = class {
    constructor() {
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
        if (callback) callback(`OK: ${state.scenario}/${state.session}`)
    }
    start(callback) {
        if (callback) callback('OK');
    }
    append(stamp, voltage, current, callback) {
        console.log(`${stamp}: v=${voltage} i=${current}`)
        if (callback) {
            callback('OK')
        }
    }
    stop(callback) {
        if (callback) callback('OK');
    }
    status(callback) {
        callback(null, this.state.session, 0)
    }
    truncate(callback) {
        if (callback) callback('OK');
    }
    rebuild(callback) {
        if (callback) callback('OK');
    }
    close(callback) {
        return callback()
    }
}
