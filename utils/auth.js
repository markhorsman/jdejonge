const 	restify 		= require('restify'),
		errors 			= require('restify-errors'),
    	passport 		= require('passport'),
    	BasicStrategy 	= require('passport-http').BasicStrategy
;

const config 	= require('../config.json');
const user 		= { id: 1, username: config.api.username, password: config.api.password };
 
passport.use(new BasicStrategy(
    function (username, password, done) {
        findByUsername(username, function (err, user) {
            if (err) {
                return done(err);
            }
            if (!user) {
                return done(null, false, { message: 'Incorrect username.' });
            }
            if (user.password !== password) {
                return done(null, false, { message: 'Incorrect password.' });
            }
            return done(null, user);
        });
    }
));
 
function findByUsername(username, fn) {
    if (user.username === username) {
        return fn(null, user);
    }

    return fn(null, null);
}
 
module.exports.authenticate = function (req, res, next, callback) {
    passport.authenticate('basic', function (err, user) {
        if (err) {
            return next(err);
        }
        if (!user) {
            const error = new errors.InvalidCredentialsError("API Inloggegevens incorrect.");
            console.log("Failed to authenticate!");
            res.send(error);
            return next();
        }
 
        callback(req, res, next);
    })(req, res, next);
};