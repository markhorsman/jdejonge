const restify 	= require('restify');
const bb 		= require("bluebird");
const sql 		= bb.promisifyAll(require("mssql"));
const _			= require("lodash");
const process	= require("process");

const config	= require('./config.json');
console.log(config);
const basicAuth = require(__dirname + '/./utils/auth');

let dbpool 		= null;
let server 		= null;

const sql_config 	= {
    user		: config.mssql.user,
    password	: config.mssql.password,
    server 		: config.mssql.server,
    database	: config.mssql.database
}

function respondJSON(res, next, msg) {
	console.log("sending response: %s", JSON.stringify(msg));
  	res.json(msg.code, msg);
  	next();
}

function respondWithError(res, next, err, code = 500) {
	msg = { result: null, message: 'Something went wrong while processing your request', code: code };
	res.send(code, msg);
	next();
}

function run() {
	return sql.connect(sql_config);
}

function prepResult(result) {
	const msg = { result: null, message: null, code: 200 };

	return new Promise(function(resolve, reject) {
		if (!result || !result.recordset.length) {
			msg.message 	= 'No records found';
			msg.code 		= 404;
			return resolve(msg);	
		} 
		 _.each(result.recordset, function(row) {
		  	msg.result = row;
		  	return resolve(msg); 
		})
	});
}

function findStockItemByBarcode(barcode) {
	return dbpool.request()
    .input('input_parameter', sql.NVarChar, barcode)
    .query('SELECT TOP 1 BARCODE, CALCODE, DESC#1, DESC#2, DESC#3, ITEMNO, STATUS, NLCODE FROM dbo.Stock where BARCODE = @input_parameter');
}

function getStockItem(req, res, next) {
	findStockItemByBarcode(req.params.barcode)
		.then(prepResult)
		.then((json) => respondJSON(res, next, json))
		.catch((err) => {
			console.log(err); 
			respondWithError(res, next, err) } 
	);
}

function listen(pool) {
	dbpool = pool;

	console.log('connected to database: %s', sql_config.database);

	server = restify.createServer();
	
	server.get('/stock/:barcode', function(req, res, next) {
		basicAuth.authenticate(req, res, next, getStockItem);
	 });

	server.listen(8080, function() {
	  console.log('%s listening at %s', server.name, server.url);	  
	});
}

sql.on('error', err => {
	console.log(err);
})

run().then(listen).catch(err => {
	console.log(err);
});

// process.on('SIGTERM', function onSigterm () {  
//   console.info('Got SIGTERM. Graceful shutdown start', new Date().toISOString())
//   // start graceul shutdown here
//   shutdown()
// })

// function shutdown() {
// 	if (dbpool) pool.close();

// 	if (server) server.close();

// 	server.on('close', function() {
// 		console.log('closed server');
// 	}) 
// }