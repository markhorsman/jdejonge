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
	const data = { code: 200 };

	return new bb(function(resolve, reject) {
		if (!result || !result.recordset.length) {
			data.message 	= 'Geen resultaat gevonden';
			data.code 		= 404;
			return resolve(data);	
		} 
		 _.each(result.recordset, function(row) {
		  	return resolve(_.extend(data, row)); 
		})
	});
}

module.exports = {
	findCustomerContactByReference : function(reference) {
		return dbpool.request()
	    .input('input_parameter', sql.NVarChar, reference)
	    .query('SELECT TOP 1 RECID, ACCT, CODE, NAME, ADDRESS1, ADDRESS2, ADDRESS3, ADDRESS4, POSTCODE, TELEPHONE, EMAIL, REFERENCE FROM dbo.CustomerContact WHERE reference = @input_parameter').then(prepResult);
	},
	findStockItemByBarcode : function(barcode) {
		return dbpool.request()
	    .input('input_parameter', sql.NVarChar, barcode)
	    .query('SELECT TOP 1 BARCODE, CALCODE, DESC#1 AS DESC1, DESC#2 AS DESC2, DESC#3 AS DESC3, ITEMNO, STATUS, NLCODE FROM dbo.Stock WHERE BARCODE = @input_parameter').then(prepResult);
	},
	updateStockItemStatus: function(itemno, status) {
		return dbpool.request()
		.input('status', sql.Int, parseInt(status))
		.input('itemno', sql.NVarChar, itemno)
		.query('UPDATE dbo.Stock SET STATUS = @status WHERE ITEMNO = @itemno');
	},
	connect : function() {
		return sql.connect(sql_config).then((pool) => { 
			dbpool = pool; 
			console.log('connected to database: %s', sql_config.database);
			return; 
		});
	}
}

sql.on('error', err => {
	console.log(err);
})