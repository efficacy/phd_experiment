const Utils = class {
  static prefix(text, p) {
    let ret = ''
    let lines = text.toString().split('\n')
    for (let i in lines) {
      let line = lines[i].trim()
      if (line) ret += p + line + '\n'
    }
    return ret
  }
  static logPrefix(text, p) {
    process.stdout.write(Utils.prefix(text, p))
  }
}

module.exports = Utils