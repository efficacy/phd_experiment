
module.exports = {
    start: function(callback) {
        if (callback) {
            callback('OK')
        }
    },
    append: function (stamp, voltage, current, callback) {
        console.log(`${stamp}: v=${voltage} i=${current}`)
        if (callback) {
            callback('OK')
        }
    },
    end: function(callback) {
        if (callback) {
            callback('OK')
        }
    }
}