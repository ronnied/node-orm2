var common = exports;
var path   = require('path');
var async  = require('async');
var ORM    = require('../');

common.ORM = ORM;

common.protocol = function () {
	return process.env.ORM_PROTOCOL;
};

common.isTravis = function() {
	return Boolean(process.env.CI);
};

common.createConnection = function(cb) {
	ORM.connect(this.getConnectionString(), cb);
};

common.hasConfig = function (proto) {
	var config;

	if (common.isTravis()) return 'found';

	try {
		config = require("./config");
	} catch (ex) {
		return 'not-found';
	}

	return (config.hasOwnProperty(proto) ? 'found' : 'not-defined');
};

common.getConfig = function () {
	if (common.isTravis()) {
		switch (this.protocol()) {
			case 'mysql':
				return { user: "root", host: "localhost", database: "orm_test" };
			case 'postgres':
			case 'redshift':
				return { user: "postgres", host: "localhost", database: "orm_test" };
			case 'sqlite':
				return {};
			case 'mongodb':
				return { host: "localhost", database: "test" };
			default:
				throw new Error("Unknown protocol");
		}
	} else {
		return require("./config")[this.protocol()];
	}
};

common.getConnectionString = function () {
	var url;

	if (common.isTravis()) {
		switch (this.protocol()) {
			case 'mysql':
				return 'mysql://root@localhost/orm_test';
			case 'postgres':
			case 'redshift':
				return 'postgres://postgres@localhost/orm_test';
			case 'sqlite':
				return 'sqlite://';
			case 'mongodb':
				return 'mongodb://localhost/test';
			default:
				throw new Error("Unknown protocol");
		}
	} else {
		var config = require("./config")[this.protocol()];

		switch (this.protocol()) {
			case 'mysql':
				return 'mysql://' +
				       (config.user || 'root') +
				       (config.password ? ':' + config.password : '') +
				       '@' + (config.host || 'localhost') +
				       '/' + (config.database || 'orm_test');
			case 'postgres':
				return 'postgres://' +
				       (config.user || 'postgres') +
				       (config.password ? ':' + config.password : '') +
				       '@' + (config.host || 'localhost') +
				       '/' + (config.database || 'orm_test');
			case 'redshift':
				return 'redshift://' +
				       (config.user || 'postgres') +
				       (config.password ? ':' + config.password : '') +
				       '@' + (config.host || 'localhost') +
				       '/' + (config.database || 'orm_test');
			case 'mongodb':
				return 'mongodb://' +
				       (config.user || '') +
				       (config.password ? ':' + config.password : '') +
				       '@' + (config.host || 'localhost') +
				       '/' + (config.database || 'test');
			case 'sqlite':
				return 'sqlite://' + (config.pathname || "");
			default:
				throw new Error("Unknown protocol");
		}
	}
	return url;
};

common.retry = function (before, run, until, done, args) {
    if (typeof until === "number") {
        var countDown = until;
        until = function (err) {
            if (err && --countDown > 0) return false;
            return true;
        };
    }

    if (typeof args === "undefined") args = [];

    var handler = function (err) {
        if (until(err)) return done.apply(this, arguments);
        return runNext();
    };

    args.push(handler);

    var runCurrent = function () {
        if (run.length == args.length) {
            return run.apply(this, args);
        } else {
            run.apply(this, args);
            handler();
        }
    };

    var runNext = function () {
        try {
            if (before.length > 0) {
                before(function (err) {
                    if (until(err)) return done(err);
                    return runCurrent();
                });
            } else {
                before();
                runCurrent();
            }
        }
        catch (e) {
            handler(e);
        }
    };

    if (before.length > 0) {
        before(function (err) {
            if (err) return done(err);
            runNext();
        });
    }
    else {
        before();
        runNext();
    }
};