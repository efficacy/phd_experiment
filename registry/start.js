const registry = require('./registry')
const { Roles, Client } = require('../shared/main')

const client = new Client(Roles.REGISTRY, 3001)
client.ensure((settings) => {
  registry.init(client, null, (err, app) => {
    if (err) throw err
    let settings = app.get('settings')
    console.log(`about to listen on port ${settings.port}`)
    // throw new Error("yikes")
    app.listen(settings.port, () => {
      if (settings.registry) {
        client.register(settings.registry, Roles.MIRROR, true)
        console.log(`Central Server Mirror listening on port ${settings.port}`)
      } else {
        console.log(`Central Server Primary listening on port ${settings.port}`)
      }
    })
  })
})
