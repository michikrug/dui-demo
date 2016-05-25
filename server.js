var serves = require('serve-static')('.', {'index': ['index.html']});
var server = require('http').createServer(function(req, res){
  serves(req, res, require('finalhandler')(req, res));
})
server.listen(80);