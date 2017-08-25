const _			= require("lodash");
const db 		= require('./db');
const errors 	= require('restify-errors');

function respondJSON(res, next, msg) {
	const code = msg.code;
	delete msg.code;

	console.log("sending response: %s", JSON.stringify(msg));

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
			.then((customerContact) => { 
				return db.findLatestContractByACCT(customerContact.ACCT).then((contract) => { 
					customerContact.CONTNO 		= null;
					customerContact.ESTRETD 	= null;

					if (contract) _.extend(customerContact, contract)
					respondJSON(res, next, customerContact); 
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
		const estretd 		= req.body.ESTRETD;

		console.log(req.body);

		db.findStockItemByItemno(itemno)
			.then((stockItem) => {
				if (!stockItem)
					return respondWithError(res, next,  "Ophalen van artikel is mislukt.");
			
				return db.findLatestContItemRow(contno).then((roworder) => {
					return db.getContract(contno).then((contract) => {
						if (!contract)
							return respondWithError(res, next,  "Ophalen van contract is mislukt.");

						// calculate ContItem charge and add to Contract totals
						const charge 	= (stockItem.RATE1 ? stockItem.RATE1 : 0); // TODO: calculate this the right way!!!
						const goods 	= contract.GOODS + charge;
						const vat 		= (goods * (stockItem.VATRATE / 100));
						const total 	= goods + vat; 

						return db.insertContItem(acct, contno, contstatus, qty, roworder, estretd, charge, stockItem).then((result) => {
							if (!result.rowsAffected[0]) return respondWithError(res, next,  "Opslaan van artikel contract item is mislukt.");

							return db.updateContractTotals(contno, goods, vat, total).then((result) => {
								return db.updateStockItemStatus(itemno, stockstatus)
									.then((result) => { respondJSON(res, next, { code: 200, status: !!result.rowsAffected[0] }); })
									.catch((err) => {
										console.log(err); 
										respondWithError(res, next,  "Opslaan van artikel status is mislukt.");
									} 
								);	
							})
						})	
					})	
				})	
			})
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next) } 
		);
	}
}

