const bb 		= require("bluebird");
const sql 		= bb.promisifyAll(require("mssql"));
const _			= require("lodash");
const moment	= require("moment");
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

function generateRecId() {
	return moment().format('YYYYMMDDHHmmss') + Math.floor(100000 + Math.random() * 900000);
}

module.exports = {
	findCustomerContactByReference : function(reference) {
		return dbpool.request()
	    .input('reference', sql.NVarChar, reference)
	    .query('SELECT TOP 1 RECID, ACCT, CODE, NAME, ADDRESS1, ADDRESS2, ADDRESS3, ADDRESS4, POSTCODE, TELEPHONE, EMAIL, REFERENCE FROM dbo.CustomerContact WHERE reference = @reference').then(prepResult);
	},
	findStockItemByItemno : function(itemno) {
		const stockPrefix 	= 'dbo.Stock.';
		const ratesPrefix 	= 'dbo.Rates.';
		const vatRatePrefix = 'dbo.VatRates.';

		return dbpool.request()
	    .input('itemno', sql.NVarChar, itemno.toLowerCase().replace(/\W/g, ''))
	    .query('SELECT TOP 1 ' + stockPrefix + 'BARCODE, '+ stockPrefix + 'CALCODE, '+ stockPrefix + 'DESC#1 AS DESC1, '+ stockPrefix + 'DESC#2 AS DESC2, '+ stockPrefix + 'DESC#3 AS DESC3, '+ stockPrefix + 'ITEMNO, '+ stockPrefix + 'STATUS,' + stockPrefix + 'NLCODE, '+ stockPrefix + 'GRPCODE, '+ stockPrefix + 'VATCODE, '+ stockPrefix + 'DEFDEP, '+ stockPrefix + 'NLCC, ' + stockPrefix + '[UNIQUE], ' + ratesPrefix + 'CODE, '+ ratesPrefix + 'RATE#1 AS RATE1, '+ ratesPrefix + 'RATE#2 AS RATE2, '+ ratesPrefix + 'RATE#3 AS RATE3, '+ ratesPrefix + 'RATE#4 AS RATE4, '+ vatRatePrefix + 'VATRATE FROM dbo.Stock LEFT JOIN dbo.Rates ON dbo.Stock.ITEMNO = dbo.Rates.ITEMNO LEFT JOIN dbo.VatRates ON dbo.Stock.VATCODE = dbo.VatRates.CODE WHERE LOWER( '+ stockPrefix + 'ITEMNO) = @itemno').then(prepResult);
	},
	updateStockItemStatus: function(itemno, status) {
		return dbpool.request()
		.input('status', sql.Int, parseInt(status))
		.input('itemno', sql.NVarChar, itemno)
		.query('UPDATE dbo.Stock SET STATUS = @status WHERE ITEMNO = @itemno');
	},
	updateContItemStatus: function(contno, itemno, status, reference) {
		return dbpool.request()
		.input('status', sql.Int, parseInt(status))
		.input('contno', sql.NVarChar, contno)
		.input('itemno', sql.NVarChar, itemno)
		.input('memo', sql.NText, reference)
		.query('UPDATE dbo.ContItems SET STATUS = @status WHERE CONTNO = @contno AND ITEMNO = @itemno AND MEMO LIKE @memo');
	},
	findLatestContractByACCT: function(acct) {
		return dbpool.request()
		.input('acct', sql.NVarChar, acct)
		.input('contno', sql.NVarChar, '00002%')
		.query('SELECT TOP 1 CONTNO, ESTRETD FROM dbo.Contracts WHERE ACCT = @acct AND CONTNO LIKE @contno ORDER BY CONTNO DESC')
		.then((result) => { return (result.recordset.length ? result.recordset[0] : null); });
	},
	getContract: function(contno) {
		return dbpool.request()
		.input('contno', sql.NVarChar, contno)
		.query('SELECT TOP 1 GOODS, VAT, TOTAL FROM dbo.Contracts WHERE CONTNO = @contno')
		.then((result) => { return (result.recordset.length ? result.recordset[0] : null); });
	},
	updateContractTotals: function(contno, goods, vat, total) {
		return dbpool.request()
		.input('contno', sql.NVarChar, contno)
		.input('goods', sql.Decimal(15,2), goods)
		.input('vat', sql.Decimal(15,2), vat)
		.input('total', sql.Decimal(15,2), total)
		.query('UPDATE dbo.Contracts SET GOODS = @goods, VAT = @vat, TOTAL = @total WHERE CONTNO = @contno')
	},
	findLatestContItemRow: function(contno) {
		return dbpool.request()
		.input('contno', sql.NVarChar, contno)
		.query('SELECT TOP 1 ROWORDER FROM dbo.ContItems WHERE dbo.ContItems.CONTNO = @contno ORDER BY ROWORDER DESC')
		.then((result) => { return (result.recordset.length ? result.recordset[0].ROWORDER : null); })
	},
	findContItem : function(contno, itemno, acct, reference) {
		return dbpool.request()
		.input('contno', sql.NVarChar, contno)
		.input('itemno', sql.NVarChar, itemno)
		.input('acct', sql.NVarChar, acct)
		.input('memo', sql.NText, reference)
		.query('SELECT TOP 1 CONTNO, ACCT, TYPE, ITEMNO, ITEMDESC, QTY, DISCOUNT, STATUS, MEMO FROM dbo.ContItems WHERE CONTNO = @contno AND ITEMNO = @itemno AND ACCT = @acct AND MEMO LIKE @memo ORDER BY CONTNO DESC')
		.then((result) => { return (result.recordset.length ? result.recordset[0] : null); });
	},
	// TODO: updateContItem method

	insertContItem: function(acct, reference, contno, status, qty, roworder, estretd, charge, stockItem) {
		const dt = moment().format('YYYY-MM-DD HH:mm:ss.SSS');

		return dbpool.request()
		.input('recid', sql.NVarChar, generateRecId())
		.input('contno', sql.NVarChar, contno)
		.input('acct', sql.NVarChar, acct)
		.input('type', sql.Int, 0)
		.input('itemno', sql.NVarChar, stockItem.ITEMNO)
		.input('itemdesc', sql.NVarChar, stockItem.DESC1)
		.input('itemdesc2', sql.NVarChar, stockItem.DESC2)
		.input('itemdesc3', sql.NVarChar, stockItem.DESC3)
		.input('subgrp', sql.NVarChar, stockItem.GRPCODE)
		.input('discount', sql.Int, 0)
		.input('insurance', sql.Int, 0)
		.input('ratecode', sql.NVarChar, stockItem.CODE)
		.input('fixrate', sql.Int, 0)
		.input('fixamt', sql.Int, 0)
		.input('fixdays', sql.Int, 0)
		.input('qty', sql.Int, parseInt(qty))
		.input('tofollow', sql.Int, 0)
		.input('rate1', sql.Decimal(15,4), (stockItem.RATE1 ? stockItem.RATE1 : 0)) // rate for 1 day
		.input('rate2', sql.Decimal(15,4), (stockItem.RATE2 ? stockItem.RATE2 : 0)) // rate for 2 days
		.input('rate3', sql.Decimal(15,4), (stockItem.RATE3 ? stockItem.RATE3 : 0)) // rate for 1 week
		.input('rate4', sql.Decimal(15,4), (stockItem.RATE4 ? stockItem.RATE4 : 0)) // rate for additional day
		.input('rate5', sql.Int, 0)
		.input('rate6', sql.Int, 0)
		.input('rate7', sql.Int, 0)
		.input('rate8', sql.Int, 0)
		.input('rate9', sql.Int, 0)
		.input('rate10', sql.Int, 0)
		.input('vatcode', sql.Int, stockItem.VATCODE)
		.input('spl', sql.Int, 0)
		.input('status', sql.Int, parseInt(status))
		.input('qtyretd', sql.Int, 0)
		.input('invoho', sql.NVarChar, 0)
		.input('ohrec', sql.NVarChar, '')
		.input('depot', sql.NVarChar, stockItem.DEFDEP)
		.input('baycode', sql.NVarChar, '')
		.input('nlcode', sql.NVarChar, stockItem.NLCODE)
		.input('nlcc', sql.NVarChar, stockItem.NLCC)
		.input('nldept', sql.NVarChar, '')
		.input('calcode', sql.NVarChar, stockItem.CALCODE)
		.input('safetype', sql.Int, 0)
		.input('safemode', sql.Int, 0)
		.input('deldate', sql.NVarChar, dt)
		.input('deltime', sql.NVarChar, '00:00')
		.input('hiredate', sql.NVarChar, dt)
		.input('hiretime', sql.NVarChar, '00:00')
		.input('lastinv', sql.NVarChar, '1899-12-30 00:00:00.000') // TODO: get from some table
		.input('lastinvt', sql.NVarChar, '')
		.input('estretd', sql.NVarChar, estretd)
		.input('estrett', sql.NVarChar, '00:00')
		.input('suspdays', sql.Int, 0)
		.input('susptotal', sql.Int, 0)
		.input('docno1', sql.Int, 0) // TODO: find out if we need these!
		.input('docno2', sql.Int, 0)
		.input('docno3', sql.Int, 0)
		.input('docno4', sql.Int, 0)
		.input('docno5', sql.Int, 0)
		.input('docno6', sql.Int, 0)
		.input('docno7', sql.Int, 0)
		.input('docno8', sql.Int, 0)
		.input('docdate1', sql.NVarChar, '')
		.input('docdate2', sql.NVarChar, '')
		.input('docdate3', sql.NVarChar, '')
		.input('docdate4', sql.NVarChar, '')
		.input('docdate5', sql.NVarChar, '')
		.input('docdate6', sql.NVarChar, '')
		.input('docdate7', sql.NVarChar, '')
		.input('docdate8', sql.NVarChar, '')
		.input('memovis', sql.Int, 0)
		.input('exfrom', sql.NVarChar, '')
		.input('exto', sql.NVarChar, '')
		.input('prtflags', sql.NVarChar, '')
		.input('plprinted', sql.Int, 0)
		.input('weight', sql.Int, 0)
		.input('memo', sql.NVarChar, reference)
		.input('extmemo', sql.NVarChar, '')
		.input('safeflag', sql.Int, 0)
		.input('paritem', sql.NVarChar, '')
		.input('colqty', sql.Int, 0)
		.input('uncollect', sql.Int, 0)
		.input('xhcost', sql.Int, 0)
		.input('ourordno', sql.NVarChar, '')
		.input('poacct', sql.NVarChar, '')
		.input('xhacct', sql.NVarChar, '')
		.input('createpo', sql.Int, 0)
		.input('pirecid', sql.NVarChar, '')
		.input('poordno', sql.NVarChar, '')
		.input('poqty', sql.Int, 0)
		.input('invdtd', sql.Int, 0)
		.input('charge', sql.Int, charge) // calculate using dbo.Rates table and diff DELDATE / ESTRETD fields
		.input('linetot', sql.Int, charge) // == charge
		.input('lastino', sql.Int, 0)
		.input('qppdesc', sql.NVarChar, '')
		.input('packqty', sql.Int, 0)
		.input('meter', sql.Int, 0)
		.input('meterbased', sql.Int, 0)
		.input('addnoho', sql.Int, 0)
		.input('addnhours', sql.Int, 0)
		.input('driver', sql.NVarChar, '')
		.input('priority', sql.NVarChar, '')
		.input('xhoffhref', sql.NVarChar, '')
		.input('xhoffhsupp', sql.Int, 0)
		.input('ratetocust', sql.Int, 0)
		.input('cigroup', sql.NVarChar, '')
		.input('uelastinv', sql.NVarChar, '')
		.input('exlastdays', sql.Int, 0)
		.input('issue', sql.Int, 0)
		.input('origirecid', sql.NVarChar, '')
		.input('lohdisc', sql.Int, 0)
		.input('bcoffhire', sql.Int, 0)
		.input('deviceid', sql.NVarChar, '')
		.input('salegroup', sql.Int, 0)
		.input('cost', sql.Int, 0)
		.input('exchreason', sql.NVarChar, '')
		.input('sid', sql.NVarChar, moment().format('YYYY-MM-DD HH:mm:ss'))
		.input('pencilled', sql.Int, 0)
		.input('resource', sql.Int, 0)
		.input('roworder', sql.Int, (roworder ? roworder + 1 : 1))
		.input('originalitemno', sql.NVarChar, '')
		.input('originalgroup', sql.NVarChar, '')
		.input('originaltype', sql.Int, 0)
		.input('cigroupname', sql.NVarChar, '')
		.input('declinezerocharge', sql.Int, 0)
		.input('accessoriesuseitemsupplier', sql.Int, 0)
		.input('excludesc', sql.Int, 0)
		.input('qtypicked', sql.Int, 0)
		.input('accessoryrecid', sql.NVarChar, '')
		.input('accessoryxhire', sql.Int, 0)
		.input('nodays', sql.Int, 0)
		.input('nodisc', sql.Int, 0)
		.input('budgetcost', sql.Int, 0)
		.input('exchdocnofrom', sql.Int, 0)
		.input('exchdocnoto', sql.Int, 0)
		.input('exchdocdatefrom', sql.NVarChar, '')
		.input('exchdocdateto', sql.NVarChar, '')
		.input('includeweight', sql.Int, 1)
		.input('mobiledelivered', sql.Int, 0)
		.input('mobiledelqty', sql.Int, 0)
		.input('mobiledelqtyalert', sql.Int, 0)
		.input('priceagreed', sql.Int, 0)
		.input('xhdiscount', sql.Int, 0)
		.input('container', sql.NVarChar, '')
		.input('specialrate', sql.Int, 0)
		.input('sccode', sql.NVarChar, '')
		.input('internalcost', sql.Int, 0)
		.input('totalcost', sql.Int, 0)
		.input('qtypacked', sql.Int, 0)
		.input('custom1', sql.NVarChar, '')
		.input('custom2', sql.NVarChar, '')
		.input('custom3', sql.NVarChar, '')
		.input('custom4', sql.NVarChar, '')
		.input('custom5', sql.NVarChar, '')
		.input('custom6', sql.NVarChar, '')
		.input('custom7', sql.NVarChar, '')
		.input('custom8', sql.NVarChar, '')
		.input('custom9', sql.NVarChar, '')
		.input('custom10', sql.NVarChar, '')
		.query('INSERT INTO dbo.ContItems ([RECID],[CONTNO],[ACCT],[TYPE],[ITEMNO],[ITEMDESC],[ITEMDESC#2],[ITEMDESC#3],[SUBGRP],[DISCOUNT],[INSURANCE],[RATECODE],[FIXRATE],[FIXAMT],[FIXDAYS],[QTY],[TOFOLLOW],[RATE#1],[RATE#2],[RATE#3],[RATE#4],[RATE#5],[RATE#6],[RATE#7],[RATE#8],[RATE#9],[RATE#10],[VATCODE],[SPL],[STATUS],[QTYRETD],[INVOHO],[OHREC],[DEPOT],[BAYCODE],[NLCODE],[NLCC],[NLDEPT],[CALCODE],[SAFETYPE],[SAFEMODE],[DELDATE],[DELTIME],[HIREDATE],[HIRETIME],[LASTINV],[LASTINVT],[ESTRETD],[ESTRETT],[SUSPDAYS],[SUSPTOTAL],[DOCNO#1],[DOCNO#2],[DOCNO#3],[DOCNO#4],[DOCNO#5],[DOCNO#6],[DOCNO#7],[DOCNO#8],[DOCDATE#1],[DOCDATE#2],[DOCDATE#3],[DOCDATE#4],[DOCDATE#5],[DOCDATE#6],[DOCDATE#7],[DOCDATE#8],[MEMOVIS],[EXFROM],[EXTO],[PRTFLAGS],[PLPRINTED],[WEIGHT],[MEMO],[EXTMEMO],[SAFEFLAG],[PARITEM],[COLQTY],[UNCOLLECT],[XHCOST],[OURORDNO],[POACCT],[XHACCT],[CREATEPO],[PIRECID],[POORDNO],[POQTY],[INVDTD],[CHARGE],[LINETOT],[LASTINO],[QPPDESC],[PACKQTY],[METER],[METERBASED],[ADDNOHO],[ADDNHOURS],[DRIVER],[PRIORITY],[XHOFFHREF],[XHOFFHSUPP],[RATETOCUST],[CIGROUP],[UELASTINV],[EXLASTDAYS],[ISSUE],[ORIGIRECID],[LOHDISC],[BCOFFHIRE],[DEVICEID],[SALEGROUP],[COST],[EXCHREASON],[SID],[PENCILLED],[RESOURCE],[ROWORDER],[ORIGINALITEMNO],[ORIGINALGROUP],[ORIGINALTYPE],[CIGROUPNAME],[DECLINEZEROCHARGE],[ACCESSORIESUSEITEMSUPPLIER],[EXCLUDESC],[QTYPICKED],[ACCESSORYRECID],[ACCESSORYXHIRE],[NODAYS],[NODISC],[BUDGETCOST],[EXCHDOCNOFROM],[EXCHDOCNOTO],[EXCHDOCDATEFROM],[EXCHDOCDATETO],[INCLUDEWEIGHT],[MOBILEDELIVERED],[MOBILEDELQTY],[MOBILEDELQTYALERT],[PRICEAGREED],[XHDISCOUNT],[CONTAINER],[SPECIALRATE],[SCCODE],[INTERNALCOST],[TOTALCOST],[QTYPACKED],[CUSTOM1],[CUSTOM2],[CUSTOM3],[CUSTOM4],[CUSTOM5],[CUSTOM6],[CUSTOM7],[CUSTOM8],[CUSTOM9],[CUSTOM10]) VALUES(@recid,@contno,@acct,@type,@itemno,@itemdesc,@itemdesc2,@itemdesc3,@subgrp,@discount,@insurance,@ratecode,@fixrate,@fixamt,@fixdays,@qty,@tofollow,@rate1,@rate2,@rate3,@rate4,@rate5,@rate6,@rate7,@rate8,@rate9,@rate10,@vatcode,@spl,@status,@qtyretd,@invoho,@ohrec,@depot,@baycode,@nlcode,@nlcc,@nldept,@calcode,@safetype,@safemode,@deldate,@deltime,@hiredate,@hiretime,@lastinv,@lastinvt,@estretd,@estrett,@suspdays,@susptotal,@docno1,@docno2,@docno3,@docno4,@docno5,@docno6,@docno7,@docno8,@docdate1,@docdate2,@docdate3,@docdate4,@docdate5,@docdate6,@docdate7,@docdate8,@memovis,@exfrom,@exto,@prtflags,@plprinted,@weight,@memo,@extmemo,@safeflag,@paritem,@colqty,@uncollect,@xhcost,@ourordno,@poacct,@xhacct,@createpo,@pirecid,@poordno,@poqty,@invdtd,@charge,@linetot,@lastino,@qppdesc,@packqty,@meter,@meterbased,@addnoho,@addnhours,@driver,@priority,@xhoffhref,@xhoffhsupp,@ratetocust,@cigroup,@uelastinv,@exlastdays,@issue,@origirecid,@lohdisc,@bcoffhire,@deviceid,@salegroup,@cost,@exchreason,@sid,@pencilled,@resource,@roworder,@originalitemno,@originalgroup,@originaltype,@cigroupname,@declinezerocharge,@accessoriesuseitemsupplier,@excludesc,@qtypicked,@accessoryrecid,@accessoryxhire,@nodays,@nodisc,@budgetcost,@exchdocnofrom,@exchdocnoto,@exchdocdatefrom,@exchdocdateto,@includeweight,@mobiledelivered,@mobiledelqty,@mobiledelqtyalert,@priceagreed,@xhdiscount,@container,@specialrate,@sccode,@internalcost,@totalcost,@qtypacked,@custom1,@custom2,@custom3,@custom4,@custom5,@custom6,@custom7,@custom8,@custom9,@custom10)');
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
