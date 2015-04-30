var Config = require('./config');
var Hapi = require('hapi');
var Json = require('jsonfile');
var Portfinder = require('portfinder');

var http = new Hapi.Server({ debug: false, connections: { state: { clearInvalid: true, ignoreErrors: true } } });
http.connection({ port: 9000, routes: { cors: { origin: ['*'], methods: ['GET', 'HEAD'], headers: [], exposedHeaders: [] } } });

Portfinder.basePort = 9001;

http.route({ method: ['GET', 'POST', 'PUT', 'DELETE'], path: '/{all*}', handler: function(request, reply) {
	var host = request.headers.host.split(':')[0];
	var bi = Config.branches[host];

	if (!bi) {
		return reply('bad branchy: ' + host);
	}

	reply.proxy({ host: 'localhost', port: bi.port, protocol: 'http' });
}});

http.route({ method: 'GET', path: '/{branch}/port', handler: function(request, reply) {
	if (Config.branches[request.params.branch]) {
		return reply(Config.branches[request.params.branch].port);
	}

	Portfinder.getPort(function (err, port) {
		Config.branches[request.params.branch] = { port: port };
		Json.writeFile('./config/index.json', Config);
		Portfinder.basePort++;

		reply(port);
	});
}});

http.start();