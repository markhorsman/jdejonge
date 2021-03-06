const restify 	= require('restify');
const bb 		= require("bluebird");
const sql 		= bb.promisifyAll(require("mssql"));
const _			= require("lodash");
const process	= require("process");

const config	= require('./config.json');
const basicAuth = require(__dirname + '/./utils/auth');
const db 		= require(__dirname + '/./utils/db');
const handlers	= require(__dirname + '/./utils/handlers');

let server 		= null;

function run() {
	return db.connect();
}

function listen() {
	server = restify.createServer({ name: config.api.name, version: config.api.version });

	server.use(restify.plugins.bodyParser());
	
	server.get('/stock/:itemno/:contno/:acct/:customername', function(req, res, next) {
		basicAuth.authenticate(req, res, next, handlers.getStockItem);
	 });

	server.get('/customer/:reference', function(req, res, next) {
		basicAuth.authenticate(req, res, next, handlers.getCustomerContact);
	 });

	server.put('/stock/status/:itemno/:contno/:customername/:qty', function(req, res, next) {
		basicAuth.authenticate(req, res, next, handlers.updateStockItemStatus);
	})

	server.post('/contitem/:itemno/:contstatus/:stockstatus/:qty', function(req, res, next) {
		basicAuth.authenticate(req, res, next, handlers.insertContItem);	
	})

	server.get('/contitems/:customername', function(req, res, next) {
		basicAuth.authenticate(req, res, next, handlers.getContItemsInRent);
	 });

	server.listen(config.api.port, function() {
	  console.log('%s listening at %s', server.name, server.url);	  
	});
}

run().then(listen).catch(console.log);