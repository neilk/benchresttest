# Bench.co REST test

A (hurried) implementation of the [Bench.co REST test](http://resttest.bench.co/).

The app is a simple [Node.js](https://nodejs.org/) console application. You must 
have Node and npm installed, with a version larger than `0.10` or so. 

To install, type the following commands at a shell prompt:

```
    $ git clone git@github.com:neilk/benchresttest.git
    $ cd benchresttest
    $ npm install
    $ node bench.js
```

The app will fetch pages from the REST API, deduplicate transactions, and present 
totals for all ledgers and each ledger. The output is in JSON on the console.

## Notes

Many of the extra-credit stories seemed to imply a more interactive app, like a web
page. I didn't have time to do that, but I used Node to make it possible later.

Regrettably, there are no tests, although I try to write in a side-effects-free style
to facilitate them.

Deduplication was done naively. In a real application
I would somehow flag duplicate items and prompt the user to confirm this. Or, possibly
we would automatically remove duplicates, but give the user some indication that they
can un-duplicate those transactions.

The app is written in a somewhat antique style for Node.js, as it doesn't use 
any source translation or async syntax, but I wanted to keep it simple. Also, I haven't
written Node that often in the past year.

Stories not implemented:
- Removing "junk" from names
- Daily calculated balances

Thanks for your time.

-- Neil Kandalgaonkar <neilk@neilk.net>
