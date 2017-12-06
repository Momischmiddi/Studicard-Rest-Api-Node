var express = require('express');
var router = express.Router();
var sql = require('mysql');

/* This secret key is sent on every user registration.
 * it ensures that the database does not get flooded.
 */
var SECRET_KEY = "NDudbiabIASIUBASiuBwnijjnKnjcaUjJDJD838a8sd98yxbcbahSBqidnBCBaussdhqijwqDASd8318231648SBAasd7ohhlgh";

var connection = sql.createConnection({
    host:       'localhost',
    user:       'root',
    password:   'A8j710758juh',
    database:   'nfc_statistics'
});

connection.connect(function(err) {
    if (err) {
        console.log('Error while connection to database: ' , err.stack);
        throw err;
    }
    console.log("Connected to MySQL!");
});

/************************************************************** ROUTES **************************************************************/

router.put('/putcarddata', function(req, res, next) {
    var clientKey = req.body.key;
    var cardId = req.body.cardId;
    var lastTransaction = req.body.lastTransaction;
    var cardValue = req.body.cardValue;

    if(!clientKey || clientKey != SECRET_KEY){
        res.send('No permission.');
    }else{
        var getDataForUser = "SELECT * FROM nfc_statistics.card_info WHERE cardId = " + cardId;
        connection.query(getDataForUser, function (err, rows) {
            if(lastScanHasSameValue(lastTransaction, cardValue, rows)){
                res.send('Value already added to the database.');
            }else{
                var putCardDataIntoDataBase = "INSERT INTO nfc_statistics.card_info (cardId, lastTransaction, cardValue, date) VALUES ('"+ cardId + "', '" + lastTransaction + "', '" + cardValue + "', '" + castJavaScriptDateToMySqlDate(new Date()) + "')";
                connection.query(putCardDataIntoDataBase, function (err) {
                    if(err){
                        handleError(err);
                        res.send(err.stack);
                    }
                    res.send('Added the new data to the database.');
                });
            }
        });
    }
});

/**
 * Returns the card value and the last transaction for a cardid, if it exists.
 */
router.get('/cardvalue', function(req, res, next) {
    console.log('User got the cookie: ' , req.cookies['cookiename']);
    var cardId = 444;
    var getDataForUser = "SELECT * FROM nfc_statistics.card_info WHERE cardId = " + cardId;
    connection.query(getDataForUser, function (err, rows) {
        if (err) {
            handleError(err);
            res.send(err.stack);
        } else {
            var newestScan = getNewestScanFromNfcData(rows);
            if(!newestScan){
                res.send("The user with the requested id does not exist in the database");
                return;
            }
            var result = {
                cardValue: newestScan.cardValue,
                lastTransaction: newestScan.lastTransaction
            };
            res.send(result);
        }
    });
});

/*
 *  Returns the statistics
 */
router.get('/statistics', function(req, res, next) {
    var getAllInformations = "SELECT * FROM nfc_statistics.card_info";
    var cardId = "444"

    var cardsInDataBase;

    var averageSpentTodayOthers;
    var averageSpentThisMonthOthers;
    var averageSpentThisYearOthers;
    var averageSpentTotal;

    var spentToday;
    var spentThisMonth;
    var spentThisYear;
    var spentTotal;

    connection.query(getAllInformations, function (err, rows) {
        if (err) {
            handleError(err);
            res.send(err.stack);
        } else {
            var allCardIds = getAllCardIds(rows);
            if(!allCardIds){
                res.send("No card ids were found in the database.");
                return;
            }
            cardsInDataBase = allCardIds.length;

            /* Get all last Transactions from the different timestamps */
            var todaysLastTransactionOthers = getAllLastTransactionsFromToday(rows);
            averageSpentTodayOthers = calculateLastTransactionAverageForDataBaseRows(todaysLastTransactionOthers);

            var thisMonthLastTransactionOthers = getAllLastTransactionsFromThisMonth(rows);
            averageSpentThisMonthOthers = calculateLastTransactionAverageForDataBaseRows(thisMonthLastTransactionOthers);

            var thisYearLastTransactionOthers = getAllLastTransactionsFromThisYear(rows);
            averageSpentThisYearOthers = calculateLastTransactionAverageForDataBaseRows(thisYearLastTransactionOthers);

            var totalLastTransactionOthers = getAllLastTransactionsFromAllTime(rows);
            averageSpentTotal = calculateLastTransactionAverageForDataBaseRows(totalLastTransactionOthers);
            /***********************************************************/

            /* Get the users last Transactions from the different timestamps */
            var todaysLastTransactionUser = getAllLastTransactionsFromTodayForCardId(rows, cardId);
            spentToday = calculateLastTransactionAverageForDataBaseRows(todaysLastTransactionUser);

            var thisMonthTransactionUser = getAllLastTransactionsFromThisMonthForCardId(rows, cardId);
            spentThisMonth = calculateLastTransactionAverageForDataBaseRows(thisMonthTransactionUser);

            var thisYearsTransactionUser = getAllLastTransactionsFromThisYearForCardId(rows, cardId);
            spentThisYear = calculateLastTransactionAverageForDataBaseRows(thisYearsTransactionUser);

            var totalTransactionUser = getAllLastTransactionsForAllScansForCardId(rows, cardId);
            spentTotal = calculateLastTransactionAverageForDataBaseRows(totalTransactionUser);
            /***********************************************************/


            var result = {
                cardsInDataBase : cardsInDataBase,

                averageSpentTodayOthers : averageSpentTodayOthers,
                averageSpentThisMonthOthers : averageSpentThisMonthOthers,
                averageSpentThisYearOthers : averageSpentThisYearOthers,
                averageSpentTotal : averageSpentTotal,

                spentToday : spentToday,
                spentThisMonth : spentThisMonth,
                spentThisYear : spentThisYear,
                spentTotal : spentTotal
            }
            res.send(result);
        }
    });
});

/*
 * Returns all dates, at which transactions have been made
 */
router.get('/getalltransactiondates', function(req, res, next) {
    var cardId = 444;
    var getDataForUser = "SELECT * FROM nfc_statistics.card_info WHERE cardId = " + cardId;
    connection.query(getDataForUser, function (err, rows) {
        if (err) {
            handleError(err);
            res.send(err.stack);
        } else {
            var scanDates = generateScanDateArray(rows);
            res.send(scanDates);
        }
    });
});

/*
 * Returns details for the given date inside the body.
 */
router.get('/getscandetails', function(req, res, next) {
    var date = new Date(req.param('date')).addHours(1); // Add one hour for the MySql one hour offset.
    var mySqlDate = castJavaScriptDateToMySqlDate(date);
    var cardId = 444;

    var getScansForDate = "SELECT * FROM nfc_statistics.card_info WHERE cardId = " + cardId + " AND date = \'" + mySqlDate + "\'";
    connection.query(getScansForDate, function (err, rows) {
        if (err) {
            handleError(err);
            res.send(err.stack);
        } else {
            var scanDetails = {
                cardValue : rows[0].cardValue,
                lastTransaction : rows[0].lastTransaction
            }
            console.log('Sending the following object: ' , scanDetails);
            res.send(scanDetails);
        }
    });
});

/*
 * Returns all transactions which have been this year, by the given card id.
 */
router.get('/alllasttransactionsthisyear', function(req, res, next) {
    var allcardvaluesthisyear;
    var cardId = 444;
    var getDataForUser = "SELECT * FROM nfc_statistics.card_info WHERE cardId = " + cardId;
    connection.query(getDataForUser, function (err, rows) {
        if (err) {
            handleError(err);
            res.send(err.stack);
        } else {
            allLastTransactionsThisYear = getAllLastTransactionsFromThisYearForCardId(rows, cardId);
            allcardvaluesthisyear = generateMonthArray(allLastTransactionsThisYear);
            var result = {
                allcardvaluesthisyear : allcardvaluesthisyear
            }
            res.send(result);
        }
    });
});

/* Returns a total history of all transactions, with the amount spent in total and the transaction amount itself */
router.get('/totalhistory', function(req, res, next) {
    var totalHistory = [];
    var totalValue = 0;
    var cardId = 444;
    var getDataForUser = "SELECT * FROM nfc_statistics.card_info WHERE cardId = " + cardId;
    connection.query(getDataForUser, function (err, rows) {
        if (err) {
            handleError(err);
            res.send(err.stack);
        } else {
            for(var i=0; i<rows.length; i++){
                totalHistory.push(rows[i].lastTransaction);
                totalValue += rows[i].lastTransaction;
            }
            var result = {
                totalHistory : totalHistory,
                totalValue : roundToTwoDigets(totalValue),
                transactionAmount : rows.length
            }
            res.send(result);
        }
    });
});

router.get('/monthlystatistics', function(req, res, next) {
    var month = req.param('month');
    var cardId = 444;
    var getDataForUser = "SELECT * FROM nfc_statistics.card_info WHERE cardId = " + cardId;
    connection.query(getDataForUser, function (err, rows) {
        if (err) {
            handleError(err);
            res.send(err.stack);
        } else {
            var lastTransactions = getLastTransactionsForGivenMonth(rows, month);
            var sum = getSumForEachDayInMonth(lastTransactions);
            var sum = fillSumWithRemainingDaysInMonth(sum, month);

            var result = {
                monthlyStatistics : sum
            }
            res.send(result);
        }
    });
});

/************************************************************** ROUTES **************************************************************/


/* Standard functions, no routes. */

function castJavaScriptDateToMySqlDate(date){
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function castMySqlDateToJavaScriptDate(date){
    var sqlDateInString = date.toString();
    return new Date(Date.parse(sqlDateInString.replace('-','/','g')));
}

/* The date has an on hour offset, for whatever reason
 * If you need the real german time, take the return value
 * of the method and add one hour.
 */
function getNewestScanFromNfcData(rows){
    if(!rows[0]){
        return null;
    }
    var newestScan = rows[0];
    for(var i=0 ; i<rows.length; i++){
        if(rows[i].date > newestScan.date){
            newestScan = rows[i];
        }
    }
    return newestScan
}

function generateScanDateArray(rows){
    var result = [];
    for(var i=0 ; i<rows.length; i++){
        var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
        result.push(scanDate);
    }
    return result;
}

function parseJavaScriptDateToFancyStringDate(date){
    var monthNames = [
        "Januar", "Februar", "März",
        "April", "Mai", "Juni", "Juli",
        "August", "September", "Oktober",
        "November", "Dezember"
    ];

    var day = date.getDate();
    var monthIndex = date.getMonth();
    var year = date.getFullYear();

    var seconds = date.getSeconds().toString();
    if(seconds.length == 1){
        seconds += '0';
    }

    var result = day + ' ' + monthNames[monthIndex] + ' ' + year + ' - ' + date.getHours() + ':' + date.getMinutes() + ':' + seconds;

    return result;
}

/* Checks if the cardvalue which should be put is a duplicate
*  If so, dont add the values to the database
*/
function lastScanHasSameValue(lastTransaction, cardValue, rows){
    var newestScan = getNewestScanFromNfcData(rows);
    return newestScan && newestScan.cardValue == cardValue && newestScan.lastTransaction == lastTransaction;
}

function fillSumWithRemainingDaysInMonth(sumForEachMonth, month){
    var daysInMonth = getDaysInMonth(month, new Date().getYear());
    var result = new Array(daysInMonth);
    for(var i=0; i<daysInMonth; i++){
        if(sumForEachMonth[i]){
            result[i] = sumForEachMonth[i];
        }else{
            result[i] = 0;
        }
    }
    return result;
}

function getDaysInMonth(month, currentYear){
    return new Date(currentYear, month, 0).getDate();
}

function getSumForEachDayInMonth(rows){
    var highestDay = 0;
    for(var i=0 ; i<rows.length; i++){
        var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
        if(scanDate.getDate() > highestDay){
            highestDay = scanDate.getDate();
        }
    }

    var averages = new Array(highestDay);
    for(var i=0; i<highestDay; i++){
        averages[i] = 0;
    }

    for(var i=0 ; i<rows.length; i++){
        var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
        var scanDay = scanDate.getDate();
        if(isNaN(averages[scanDay])){
            averages[scanDay] = 0;
        }
        averages[scanDay] += rows[i].lastTransaction;
    }

    return averages;
}

function getLastTransactionsForGivenMonth(rows, month){
    var scansInMonth = [];
    for(var i=0 ; i<rows.length; i++){
        if(rows[i].date.getMonth() == month){
            scansInMonth.push(rows[i]);
        }
    }

    return scansInMonth;
}

/*
 *  To generate the year graph, the frontend needs an array which is set up as shown:
 *  It has 12 indexes, each index stands for the month of the year, for example:
 *  arr[0] = Januar
 *  arr[11] = december.
 *  and so on
 *  each of the array values then contain the average of the last transactions for the given month.
 */
function generateMonthArray(rows){
    var result = new Array(12);
    var monthArray = new Array(12);

    /* Fill array with empty arrays. The average is then calculated from those values. */
    /* Fill the result array with zeros, so it has a defined value */
    for(var i=0; i<monthArray.length; i++) {
        monthArray[i] = [];
        result[i] = 0;
    }

    for(var i=0; i<rows.length; i++){
        var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
        monthArray[scanDate.getMonth()].push(rows[i].lastTransaction);
    }

    for(var i=0; i<result.length; i++) {
        for(var j=0 ;j<monthArray[i].length; j++){
            var x = monthArray[i][j];
            result[i] += monthArray[i][j];
        }
    }

    return result;
}

function calculateLastTransactionAverageFromArray(lastTransactionArray){
    var result = 0;
    for(var i=0; i<lastTransactionArray.length; i++){
        result += lastTransactionArray[i];
    }
    return roundToTwoDigets(result / lastTransactionArray.length);
}

function calculateLastTransactionAverageForDataBaseRows(rows){
    var result = 0.0;
    for(var i=0; i<rows.length; i++){
        result += rows[i].lastTransaction;
    }
    return roundToTwoDigets(result / rows.length);
}

function roundToTwoDigets(numb){
    return (Math.round(numb * 100)/100).toFixed(2);
}

function getAllCardIds(rows){
    if(!rows[0]){
        return null;
    }
    var allCardIds = [];
    for(var i=0 ; i<rows.length; i++){
        if(!allCardIds.includes(rows[i].cardId)){
            allCardIds.push(rows[i].cardId);
        }
    }
    return allCardIds;
}

function getLastTransactionsFromRow(rows){
    var result = [];
    for(var i=0; i<rows.length; i++){
        result.push(rows[i].lastTransaction);
    }
    return result;
}

function getAllLastTransactionsFromTodayForCardId(rows, cardId){
    var result = [];
    for(var i=0; i<rows.length; i++){
        if(rows[i].cardId == cardId) {
            var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
            var isTodaysDate = checkIfDateIsTodaysDate(scanDate);
            if (isTodaysDate) {
                result.push(rows[i]);
            }
        }
    }
    return result;
}

function getAllLastTransactionsFromThisMonthForCardId(rows, cardId){
    var result = [];
    for(var i=0; i<rows.length; i++){
        if(rows[i].cardId == cardId) {
            var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
            var isThisMonthDate = checkIfDateIsThisMonthsDate(scanDate);
            if(isThisMonthDate){
                result.push(rows[i]);
            }
        }
    }
    return result;
}

function getAllLastTransactionsFromThisYearForCardId(rows, cardId){
    var result = [];
    for(var i=0; i<rows.length; i++){
        if(rows[i].cardId == cardId) {
            var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
            var isThisYearsDate = checkIfDateIsThisYearsDate(scanDate);
            if(isThisYearsDate){
                result.push(rows[i]);
            }
        }
    }
    return result;
}

function getAllLastTransactionsForAllScansForCardId(rows, cardId){
    var result = [];
    for(var i=0; i<rows.length; i++){
        if(rows[i].cardId == cardId) {
            result.push(rows[i]);
        }
    }
    return result;
}

function getAllLastTransactionsFromToday(rows){
    var result = [];
    for(var i=0; i<rows.length; i++){
        var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
        var isTodaysDate = checkIfDateIsTodaysDate(scanDate);
        if(isTodaysDate){
            result.push(rows[i]);
        }
    }
    return result;
}

function getAllLastTransactionsFromThisMonth(rows){
    var result = [];
    for(var i=0; i<rows.length; i++){
        var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
        var isThisMonthDate = checkIfDateIsThisMonthsDate(scanDate);
        if(isThisMonthDate){
            result.push(rows[i]);
        }
    }
    return result;
}

function getAllLastTransactionsFromThisYear(rows){
    var result = [];
    for(var i=0; i<rows.length; i++){
        var scanDate = castMySqlDateToJavaScriptDate(rows[i].date);
        var isThisYearsDate = checkIfDateIsThisYearsDate(scanDate);
        if(isThisYearsDate){
            result.push(rows[i]);
        }
    }
    return result;
}

function getAllLastTransactionsFromAllTime(rows){
    var result = [];
    for(var i=0; i<rows.length; i++){
        result.push(rows[i]);
    }
    return result;
}

function checkIfDateIsThisYearsDate(date){
    return date.getYear() == new Date().getYear();
    return true;
}

function checkIfDateIsThisMonthsDate(date){
    return date.getMonth() == new Date().getMonth();
    return true;
}

function checkIfDateIsTodaysDate(date){
    var todaysDate = new Date();
    return date.setHours(0,0,0,0) == todaysDate.setHours(0,0,0,0);
}

function handleError(err){
    console.log('An error occured: ' , err.message);
    console.log(err.stack);
}

function fillArrayWithZeros(arrayToFill){
    for(var i=0; i<arrayToFill.length; i++){
        arrayToFill[i] = 0.0;
    }
    return arrayToFill;
}

/*
 * Adds hours to a date object
 */
Date.prototype.addHours= function(h){
    this.setHours(this.getHours()+h);
    return this;
}

module.exports = router;