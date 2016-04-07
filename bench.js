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
   * Fetch a page of transactions from the API
   * @param Number pageNumber
   * @param Function next node-style callback, returns API results
   */
  var fetchTransactionsPage = function(pageNumber, next) {
    var args = {path: {pageNumber: pageNumber}};
    client.methods.getTransactionsPage(args, function(results, response) {
      // console.log("results", results);
      // console.log("response", response);
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
          // we keep replacing totalCount... maybe new transactions were
          // added while we were fetching
          expectedTotalCount = results.totalCount;
          transactions = transactions.concat(results.transactions);
          pageNumber++;
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
   * Main entry point
   */
  getTransactions(function(err, transactions) {
    if (err) {
      console.error(err);
    } else {
      console.log(transactions);
    }
  });


}());



