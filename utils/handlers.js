const _			= require("lodash");
const moment	= require("moment");
const db 		= require('./db');
const errors 	= require('restify-errors');

require('moment-weekday-calc');

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
				db.findContItem(req.params.contno, req.params.itemno, req.params.acct, req.params.reference).then((contItem) => {
					json.IN_RENT_BY_CUSTOMER = false;
					json.CONTITEM = null;
					
					if (contItem && contItem.MEMO === req.params.reference) {
						json.CONTITEM = contItem;						
						json.IN_RENT_BY_CUSTOMER = true;
					}

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

		return db.updateStockItemStatus(req.params.itemno, req.body.STATUS)
			.then((result) => {
				if (!result || !result.rowsAffected) {
					return respondWithError(res, next,  "Updated van artikel status is mislukt.");
				}	

				db.updateContItemStatus(req.params.contno, req.params.itemno, 2, req.params.reference).then((result) => {
					respondJSON(res, next, { code: 200, status: !!result.rowsAffected[0] });	
				})
			})
			.catch((err) => {
				console.log(err); 
				respondWithError(res, next,  "Updated van artikel status is mislukt.");
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
		const reference     = req.body.REFERENCE;

		db.findStockItemByItemno(itemno)
			.then((stockItem) => {
				if (!stockItem)
					return respondWithError(res, next,  "Ophalen van artikel is mislukt.");
			
				return db.findLatestContItemRow(contno).then((roworder) => {
					return db.getContract(contno).then((contract) => {
						if (!contract)
							return respondWithError(res, next,  "Ophalen van contract is mislukt.");

						const rent_period = getRentPeriod(estretd);

						console.log(rent_period);
	
						if (typeof rent_period === 'undefined' || typeof rent_period.days === 'undefined' || rent_period.days < 0)
							return respondWithError(res, next,  "Ongeldige contract periode");

						// calculate ContItem charge and add to Contract totals
						const charge 	= calculateRentPriceForPeriod(rent_period, stockItem, qty);
						const goods 	= contract.GOODS + charge;
						const vat 		= (goods * (stockItem.VATRATE / 100));
						const total 	= goods + vat;

						console.log('calculated charge: %s', charge);

						// return respondWithError(res, next,  "Ophalen van contract is mislukt.");

						return db.insertContItem(acct, reference, contno, contstatus, qty, roworder, estretd, charge, stockItem).then((result) => {
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

function getRentPeriod(estretd) {
	const a = moment();
	const b = moment(estretd);

	return { days:  moment().isoWeekdayCalc(a,b,[1,2,3,4,5]), weeks: b.diff(a, 'week') };
}

function calculateRentPriceForPeriod(rent_period, stockItem, qty) {
	let price, days_remainder_price;
	const days_remainder = (rent_period.weeks ? rent_period.days - (rent_period.weeks * 5) : 0);

	const rate1 = (stockItem.RATE1 ? stockItem.RATE1 : 0);
	const rate2 = (stockItem.RATE2 ? stockItem.RATE2 : 0);
	const rate3 = (stockItem.RATE3 ? stockItem.RATE3 : 0);
	const rate4 = (stockItem.RATE4 ? stockItem.RATE4 : 0);

	console.log('days: %s, weeks: %s, days_remainder: %s', rent_period.days, rent_period.weeks, days_remainder);
	console.log('rate1: %s, rate2: %s, rate3: %s, rate4: %s', rate1, rate2, rate3, rate4);

	if (rent_period.weeks > 0) {
		switch (days_remainder) {
			case 0:
				days_remainder_price = 0;
			break;
			case 1:
			case 2:
			case 3:
			case 4:
				days_remainder_price = days_remainder * rate4;
			break;
			case 5:
				days_remainder_price = rate3;
			break;
		}

		console.log('days_remainder_price: %s', days_remainder_price);

		switch (rent_period.weeks) {
			case 1:
				price = rate3 + days_remainder_price;
			break;
			default:
				price = (rate3 * rent_period.weeks) + days_remainder_price;
			break;
		}
	} else {
		switch (rent_period.days) {
			case 0:
			case 1:
				price = rate1;
			break;
			case 2:
				price = rate2;
			break;
			default:
				price = rate1 + ((rent_period.days - 1) * rate4);
			break;
		}
	}

	return price * qty;
}

