const db = require('./db');
const errors = require('restify-errors');

function respondJSON(res, next, msg) {
	console.log("sending response: %s", JSON.stringify(msg));

	const code = msg.code;
	delete msg.code;

  	res.json(code, msg);
  	next();
}

function respondWithError(res, next, message = "Something went wrong while processing your request", code = 500) {
	res.send(new errors.InternalServerError(message));
    return next();
}

module.exports = {
	getStockItem : function(req, res, next) {
		db.findStockItemByBarcode(req.params.barcode)
			.then((json) => respondJSON(res, next, json))
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next, "Ophalen artikel mislukt.") } 
		);
	},
	getCustomerContact : function(req, res, next) {
		db.findCustomerContactByReference(req.params.reference)
			.then((json) => respondJSON(res, next, json))
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next, "Ophalen klant mislukt.") } 
		);
	},
	updateStockItemStatus: function(req, res, next) {
		if (typeof req.params.itemno === 'undefined' || typeof req.body.STATUS === 'undefined') {
		    res.send(new errors.MissingParameterError("Verplichte velden ontbreken"));
		    return next();
		}

		db.updateStockItemStatus(req.params.itemno, req.body.STATUS)
			.then((result) => { respondJSON(res, next, { code: 200, status: !!result.rowsAffected[0] }); })
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next,  "Updated artikel status mislukt.") 
			} 
		);
	}
}

