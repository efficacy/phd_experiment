const net = require('net');
const { NodeSSH } = require('node-ssh')

const nodeSSH = new NodeSSH()
const Endpoint = require('./endpoint')

const Requester = class {
    constructor(roles, defaults) {
        this.roles = roles || {}
        this.endpoint = new Endpoint(defaults).setRoles(this.roles)
    }
    setRole(name, listener) {
        this.roles[name] = listener
    }
    call(destination, action, params, callback) {
        let spec = this.endpoint.expand(destination)
        // console.log(`Requester.call dest=${destination} action=${action} params=${params}`)
        if (!spec.caller) {
            callback(`unknown protocol: ${spec.protocol}`)
        }
        let url = `${spec.url}${action}?${params}`
        // console.log(`requester.call url=${url}`)
        spec.caller.get(url, (res) => {
            let text = ''
            res.on('data', d => {
                text += d
            })
            res.on('end', () => {
                callback(null, text, res.headers)
            })
        }).on("error", (err) => {
            callback(err)
        })
    }
    ssh(endpoint, script, callback) {
      let home = process.env.HOME
      let [scheme, host, port] = endpoint.split(':')
      if (host.startsWith('//')) host = host.substring(2)
      nodeSSH.connect({
        host: host,
        username: 'pi',
        privateKey: `${home}/.ssh/id_rsa`
      }).then(() => {
        console.log(`  sending ${script} to ${host}`)
        nodeSSH.execCommand(`${script}`).then(function (result) {
          let lines = result.stdout.toString().split('\n')
          for (i in lines) {
            let line = lines[i].trim()
            if (line) console.log(`  > ${line}`);
          }
          lines = result.stderr.toString().split('\n')
          for (i in lines) {
            let line = lines[i].trim()
            if (line) console.log(`  > ${line}`);
          }
          if (callback) callback()
        })
      })
    }

}

module.exports = Requester