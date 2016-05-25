var finalhandler = require('finalhandler'),
	http = require('http'),
	serveStatic = require('serve-static');

var serve = serveStatic('.', {'index': ['index.html']});

var server = http.createServer(function(req, res){
  var done = finalhandler(req, res);
  serve(req, res, done);
})

server.listen(80);