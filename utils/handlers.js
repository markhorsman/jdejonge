const db = require('./db');
const errors = require('restify-errors');

function respondJSON(res, next, msg) {
	console.log("sending response: %s", JSON.stringify(msg));

	const code = msg.code;
	delete msg.code;

  	res.json(code, msg);
  	next();
}

function respondWithError(res, next, message = "Er is iets misgegaan tijdens het verwerken van je verzoek.", code = 500) {
	res.send(new errors.InternalServerError(message));
    return next();
}

module.exports = {
	getStockItem : function(req, res, next) {
		db.findStockItemByItemno(req.params.itemno)
			.then((json) => {
				db.findContItem(req.params.contno, req.params.itemno, req.params.acct).then((contItem) => {
					if (json.ITEMNO) json.CONTITEM = contItem;	
					respondJSON(res, next, json);	
				})	
			})
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next, "Ophalen van artikel is mislukt.") } 
		);
	},
	getCustomerContact : function(req, res, next) {
		db.findCustomerContactByReference(req.params.reference)
			.then((json) => { 
				db.findLatestContractNumberByACCT(json.ACCT).then((contno) => { 
					json.CONTNO = contno; 
					respondJSON(res, next, json); 
				})  
			})
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next, "Ophalen van klant is mislukt.") 
			} 
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
				respondWithError(res, next,  "Updated van artikel status is mislukt.") 
			} 
		);
	},
	insertContItem: function(req, res, next) {
		const itemno 		= req.params.itemno;
		const contstatus 	= req.params.contstatus;
		const stockstatus 	= req.params.stockstatus;
		const qty			= req.params.qty;
		const acct 			= req.body.ACCT;
		const contno 		= req.body.CONTNO;

		db.findStockItemByItemno(itemno)
			.then((stockItem) => {
				if (!stockItem) {
					return respondWithError(res, next,  "Ophalen van artikel is mislukt.");
				}

				return db.insertContItem(acct, contno, contstatus, qty, stockItem).then((result) => {
					if (!result.rowsAffected[0]) return respondWithError(res, next,  "Opslaan van artikel contract item is mislukt.");

					return db.updateStockItemStatus(itemno, stockstatus)
						.then((result) => { respondJSON(res, next, { code: 200, status: !!result.rowsAffected[0] }); })
						.catch((err) => {
							console.log(err); 
							respondWithError(res, next,  "Opslaan van artikel status is mislukt.");
						} 
					);
				
				})	
			})
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next) } 
		);
	}
}

