var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors')

// passport als Middleware
var passport = require('passport');
var session = require('express-session');

var cardData = require('./routes/carddata');
var login = require('./routes/login');

var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());

// Cookies erlauben
app.use(session({ cookie: { maxAge: 60000},
    secret: 'any',
    resave: false,
    saveUninitialized: false}));

// Passport als Middleware einbringen
app.use(passport.initialize());
app.use(passport.session());

app.use('/carddata', cardData);
app.use('/login', login);

app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
    res.status(err.status || 500);
  console.log('Error: ' , err.stack);
});

var port = 3001;
app.listen(port, function () {
    console.log('app listening on port ' + port);
});

module.exports = app;
