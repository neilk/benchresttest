(function() {
  'use strict';

  var async = require('async'),
      Client = require('node-rest-client').Client;

  var client = new Client();
  client.registerMethod(
    'getTransactionsPage',
    'http://resttest.bench.co/transactions/${pageNumber}.json',
    'GET'
  );

  /**
   * Given raw string data, return object with proper dates and
   * other amounts normalized
   * e.g. {
   *  "Date": "2013-12-13",  <-- we assume this is always ISO 8601, or another
   *                             format easily parsed by JS's Date()
   *  "Ledger": "Insurance Expense",
   *  "Amount": "-117.81",   <-- we assume this is always a proper number
   *  "Company": "LONDON DRUGS 78 POSTAL VANCOUVER BC"
   * }
   * Should become:
   * {
   *   date: new Date(2013, 12, 13)
   *   ledger: "Insurance Express",
   *   amount: -117.81
   *   company: "LONDON DRUGS 78 POSTAL VANCOUVER BC"
   * }
   *
   * @param Object data
   * @return Object normalized data as described above
   */
  var normalizeTransaction = function(tx) {
    return {
      date: new Date(tx.Date),
      ledger: tx.Ledger,
      amount: parseInt(tx.Amount, 10),
      company: tx.Company
    };
  };


  /**
   * Fetch a page of transactions from the API
   * @param Number pageNumber
   * @param Function next node-style callback, returns API results
   */
  var fetchTransactionsPage = function(pageNumber, next) {
    var args = {path: {pageNumber: pageNumber}};
    client.methods.getTransactionsPage(args, function(results, response) {
      if (!('page' in results)) {
        next(new Error('expected page number in results'));
      } else if (results.page !== pageNumber) {
        next(new Error('expected page number not in results'));
      } else if (!('totalCount' in results)) {
        next(new Error('expected total count in results'));
      } else if (!('transactions' in results)) {
        next(new Error('expected transactions in results'));
      } else if (typeof results.transactions !== 'object') {
        next(new Error('expected transactions to be an object'));
      } else {
        next(null, results);
      }
    }).on('error', function(err) {
      next(err);
    });
  };

  /**
   * Accumulate all the transactions from the paginated API.
   * @param Function next node-style callback returns all transactions
   */
  var getTransactions = function(next) {
    var expectedTotalCount = 0;

    // list of Transaction objects, will accumulate from API fetches
    var transactions = [];

    var pageNumber = 1;

    /**
     * Conditional function for the do-while loop to fetch transactions.
     * @return Boolean
     */
    var hasMorePages = function() {
      return transactions.length < expectedTotalCount;
    };

    /**
     * Action function for the do-while loop to fetch transactions.
     * Note that we do not return the transaction data, we're accumulating
     * it in `transactions`. So the proper exit is simply next(null)
     * @param Function next node-style callback
     */
    var accumulateTransactions = function(next) {
      fetchTransactionsPage(pageNumber, function(err, results) {
        if (err) {
          next(err);
        } else {
          try {
            // we keep replacing totalCount... maybe new transactions were
            // added while we were fetching
            expectedTotalCount = results.totalCount;
            // create proper objects from the JSON data
            results.transactions.forEach(function(tx) {
              transactions.push(normalizeTransaction(tx));
            });
            pageNumber++;
          } catch(e) {
            next(e);
          }
          next(null);
        }
      });
    };

    /**
     * Asynchronous do-while loop to fetch transactions. A do-while loop
     * is necessary because we need to do at least one API call to know
     * how many pages to fetch.
     */
    async.doWhilst(
      accumulateTransactions,
      hasMorePages,
      function(err) {
        if (err) {
          next(err);
        } else {
          next(null, transactions);
        }
      }
    );

  };

  /**
   * Custom sorting function for transactions
   * @param Object a transaction
   * @param Object b transaction
   * @return Number -1, 0, or 1
   */
  var transactionDateSort = function(a, b) {
    return function(a, b){
      if (a.date > b.date) {
        return -1;
      } else if (a.date < b.date) {
        return 1;
      } else {
        return 0;
      }
    };
  };

  /**
   * Given an array of normalized transactions, calculate the current
   * total balance. Note that transactions may be out of order.
   * Synchronous.
   *
   * @param Array transactions
   * @return Number total balance
   */
  var calculateTotalBalance = function(transactions) {
    var totalBalance = 0;
    // this isn't strictly necessary for total balance calculation.
    // but will be for running balance
    transactions.sort(transactionDateSort);
    transactions.forEach(function(tx) {
      totalBalance += tx.amount;
    });
    return totalBalance;
  };


  /**
   * Fetch transactions, obtain total balance
   * @param Function next node-style callback taking total balance
   */
  var getTotalBalance = function(next) {
    getTransactions(function(err, transactions) {
      if (err) {
        next(err);
      } else {
        try {
          next(null, calculateTotalBalance(transactions));
        } catch(e) {
          next(e);
        }
      }
    });
  };


  /**
   * Main entry point
   */
  getTotalBalance(function(err, totalBalance) {
    if (err) {
      console.error(err);
    } else {
      console.log("total balance", totalBalance);
    }
  });



}());



