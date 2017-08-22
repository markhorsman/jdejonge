const bb 		= require("bluebird");
const sql 		= bb.promisifyAll(require("mssql"));
const _			= require("lodash");
const config	= require('../config.json');

const sql_config 	= {
    user		: config.mssql.user,
    password	: config.mssql.password,
    server 		: config.mssql.server,
    database	: config.mssql.database
}

let dbpool 		= null;

function prepResult(result) {
	const msg = { result: null, message: null, code: 200 };

	return new bb(function(resolve, reject) {
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

module.exports.connect = function() {
	return sql.connect(sql_config).then((pool) => { 
		dbpool = pool; 
		console.log('connected to database: %s', sql_config.database);
		return; 
	});
}

module.exports.findStockItemByBarcode = function(barcode) {
	return dbpool.request()
    .input('input_parameter', sql.NVarChar, barcode)
    .query('SELECT TOP 1 BARCODE, CALCODE, DESC#1, DESC#2, DESC#3, ITEMNO, STATUS, NLCODE FROM dbo.Stock where BARCODE = @input_parameter').then(prepResult);
}


sql.on('error', err => {
	console.log(err);
})