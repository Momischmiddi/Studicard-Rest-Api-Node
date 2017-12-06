var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

router.post('/', function(req, res, next) {
    res.send({isLoggedIn : true});
});

module.exports = router;
