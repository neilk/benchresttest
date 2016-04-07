(function() {
  'use strict';

  var async = require('async'),
      Client = require('node-rest-client').Client,
      equal = require('deep-equal'),
      sortBy = require('sort-array');

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
      // TODO doing a Date parse adds time and timezone,
      // so it implies more accuracy than we actually have.
      // Should use an object representing Days. Or, leave it
      // as a string; ISO 8601 dates sort well already?
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
   * Remove duplicates from a sorted list of transactions.
   * Must be sorted by all properties. Assumes no transaction
   * is undefined.
   * @param Array transactions sorted
   * @return Array transactions, still sorted and deduplicated
   */
  var deduplicateTransactions = function(transactions) {
    var deduplicated = [];
    var current;
    transactions.forEach(function(tx) {
      if (!equal(tx, current)) {
        deduplicated.push(tx);
        current = tx;
      }
    });
    return deduplicated;
  };


  /**
   * Given an array of normalized transactions, calculate the current
   * total balance.
   *
   * @param Array transactions
   * @return Number total balance
   */
  var calculateTotalBalance = function(transactions) {
    var totalBalance = 0;
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
          // sorting helps deduplicate, and will also help us with
          // running totals
          transactions = sortBy(transactions,
                                ['date', 'ledger', 'company', 'amount']);
          transactions = deduplicateTransactions(transactions);
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



