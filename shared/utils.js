const Utils = class {
  static prefix(text, p) {
    let ret = ''
    let lines = text.toString().split('\n')
    for (i in lines) {
      let line = lines[i].trim()
      if (line) ret += line + '\n'
    }
    return ret
  }
  static logPrefix(text, p) {
    process.stdout.write(prefix(text, p))
  }
}

module.exports = Utils