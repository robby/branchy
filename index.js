var Config = require('./config');
var Hapi = require('hapi');
var Joi = require('joi');
var Json = require('jsonfile');
var Portfinder = require('portfinder');

var http = new Hapi.Server({ debug: false, connections: { state: { clearInvalid: false, ignoreErrors: true } } });
http.connection({ port: 9000, routes: { cors: { origin: ['*'], methods: ['GET', 'HEAD'], headers: [], exposedHeaders: [] } } });

Portfinder.basePort = 9001;

http.route({ method: ['GET'], path: '/{all*}', handler: proxyToBranch });
http.route({ method: ['POST', 'PUT', 'DELETE'], path: '/{all*}', config: { payload: { parse: false } }, handler: proxyToBranch });

http.route({ method: 'GET', path: '/{branch}/port', config: { validate: { params: { branch: Joi.string().lowercase() } } }, handler: function(request, reply) {
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

http.register({ register: require('good'), options: {
		reporters: [ { reporter: 'good-console', events: { log: '*', request: '*', response: '*', error: '*' } } ]
	}},
	function (err) {
		http.start();
	}
);

function proxyToBranch(request, reply) {
	var host = request.headers.host.split(':')[0];
	var bi = Config.branches[host];

	if (!bi) {
		return reply('bad branchy: ' + host);
	}

	delete request.headers['x-forwarded-proto'];

	reply.proxy({ host: 'localhost', port: bi.port, protocol: 'http', passThrough: true, localStatePassThrough: true });
}