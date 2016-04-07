var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: "Neil K's Bench.co REST test" });
});

module.exports = router;
