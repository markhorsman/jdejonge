const db = require('./db');

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

module.exports.getStockItem = function(req, res, next) {
	db.findStockItemByBarcode(req.params.barcode)
		.then((json) => respondJSON(res, next, json))
		.catch((err) => {
			console.log(err); 
			respondWithError(res, next, err) } 
	);
}