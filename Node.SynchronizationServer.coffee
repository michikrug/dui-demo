#install with "npm install lodash sockjs"

_      = require 'lodash'
http   = require 'http'
sockjs = require 'sockjs'
port   = 9001

if typeof String.prototype.startsWith isnt 'function'
  String.prototype.startsWith = (str) ->
    @slice(0, str.length) is str


class ConnectionHandler

  clients = []
  NAMESPACE = 'SmartComposition.'

  constructor: (@connection) ->
    @name = @session = @delay = @pingTime = null

    @id = @connection.id

    clients.push @

    @connection.on 'data', (data) =>
      message = JSON.parse data
      return unless message.type and message.type.startsWith NAMESPACE

      switch message.type.slice(NAMESPACE.length)
        when 'authentication'
          try
            @changeSession message.data.session
            @name = message.data.name || 'unknown'
            @type = message.data.type || 'undefined'
            @send JSON.stringify({ type: NAMESPACE + 'authentication.answer', data: { id: @id, name: @name, sesssion: @session } })
            @sendToSession JSON.stringify({ type: NAMESPACE + 'clients', data: { clients: @createClientsArray @getClientsOfSession() } })
          catch
            return
          return

        when 'clients'
          @send JSON.stringify({ type: NAMESPACE + 'clients', data: { clients: @createClientsArray @getClientsOfSession() } })
          return

        when 'message'
          @sendToSession data, null, false
          return

        when 'move-tile'
          @sendToClient message.data.client, data
          return

        when 'pong'
          @delay = Math.floor ((new Date()).getTime() - @pingTime) / 2
          return

        else
          @send JSON.stringify({ type: NAMESPACE + 'error', data: 'unkown command' })
          return

    @connection.on 'close', =>
      console.log ' [*] Closed'
      @close()
      return

    @send JSON.stringify({ type: NAMESPACE + 'authentication.request' })

    @pingInterval = setInterval =>
      @pingTime = (new Date()).getTime()
      @send JSON.stringify({ type: NAMESPACE + 'ping' })
    , 2000

  changeSession: (session) ->
    return if @session is session
    @sendToSession JSON.stringify({ type: NAMESPACE + 'clients', data: { clients: @createClientsArray @getClientsOfSession(null, false) } }), null, false
    @session = session
    return

  close: ->
    if @connection.readyState < 3
      @connection.close()
      return
    _.pull clients, @
    clearInterval @pingInterval
    @sendToSession JSON.stringify({ type: NAMESPACE + 'clients', data: { clients: @createClientsArray @getClientsOfSession() } })
    @connection = null
    delete @connection
    return

  send: (message) ->
    @connection.write message if @connection
    return

  broadcast: (clientList, message) ->
    if typeof clientList is 'string'
      message = clientList
      clientList = clients
    client.send message for client in clientList
    return

  createClientsArray: (clientList) ->
    clientsArray = []
    clientsArray.push { id: client.id, name: client.name, type: client.type, session: client.session } for client in clientList
    return clientsArray

  getClientById: (id) ->
    return _.find clients, { id: id }

  sendToClient: (id, message) ->
    client = @getClientById id
    client.send message if client

  getClientsOfSession: (session, includeSelf = true) ->
    clientsOfSession = _.filter clients, { session: (session || @session) }
    _.pull clientsOfSession, @ unless includeSelf
    return clientsOfSession

  sendToSession: (message, session, includeSelf = true) ->
    @broadcast @getClientsOfSession(session, includeSelf), message
    return

server = http.createServer()
server.addListener 'upgrade', (req, res) ->
  res.end()
  return

sockjs_server = sockjs.createServer { sockjs_url: '//cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.1.0/sockjs.min.js' }

sockjs_server.on 'connection', (connection) ->
  console.log ' [*] Connection'
  new ConnectionHandler connection
  return

sockjs_server.installHandlers server

console.log ' [*] Listening on Port ' + port
server.listen port