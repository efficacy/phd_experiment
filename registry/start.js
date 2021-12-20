const server = require('./server')

server.init(null, (err, app, port, primary) => {
  if (err) throw err
  console.log(`about to listen on port ${port}`)
  // throw new Error("yikes")
  app.listen(port, () => {
    if (primary) {
      client.register(primary, 'MIRROR', true)
      console.log(`Central Server Mirror listening on port ${port}`)
    } else {
      console.log(`Central Server Primary listening on port ${port}`)
    }
  })
})