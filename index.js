"use strict";

const logger = require("debug")("leaf:mw:dust"),
  codust = require("co-dust"),
  moment = require("moment"),
  glob = require("glob"),
  fs = require("fs"),
  mkdirp = require("mkdirp"),
  extend = require("extend"),
  pathModule = require("path");

const tmpDir = "./.tmp/views",
  viewDir = "resources/views";

const DEFAULTS = {
  precompile: false,
  cache: false
};

var options;

class middleware {
  constructor(opts) {
    options = extend({}, DEFAULTS, opts || {});
  }

  * initialize(next) {
    logger("using leaf dust template middleware");

    let koa = this.koa;
    let dust;
    if (options.precompile) {
      let tmpViewDir = pathModule.resolve(this.basepath, tmpDir);
      dust = new codust({
        base: tmpViewDir,
        precompiled: options.precompile
      });
      dust._dust.config.cjs = true;
      yield new Promise((resolve, reject) => {
        mkdirp.sync(tmpViewDir);
        glob(pathModule.resolve(this.basepath, viewDir) + "/**/*.dust", (err, files) => {
          if (err) {
            reject(err);
          }
          files.map((file) => {
            return [fs.readFileSync(file).toString(), file.substr([pathModule.resolve(this.basepath, viewDir), "/"].join('').length)];
          }).map((data) => {
            mkdirp.sync(pathModule.join(tmpViewDir, pathModule.dirname(data[1])));
            return fs.writeFileSync(pathModule.join(tmpViewDir, data[1]), dust._dust.compile(data[0], data[1]));
          });
          resolve();
        });
      });
    } else {
      dust = new codust({
        base: pathModule.resolve(this.basepath, ["./", viewDir].join(''))
      });
    }

    this._dust = dust;
    let helpers = require("./lib/dust_helpers");
    helpers(dust._dust);

    let leaf = this;
    koa.use(function* dustMiddleware(next) {
      let koaContext = this;
      this.render = function*(path, context) {
        context = context || {};
        if (this.res.templateContext) {
          context = extend(this.res.templateContext, context);
        }
        context.loggedIn = koaContext.req.isAuthenticated;
        context.user = koaContext.req.user;
        context.today = moment();
        if (false === options.cache) {
          delete leaf._dust._dust.cache[path];
        }
        koaContext.body = yield dust.render(path, context);
      };
      yield * next;
    });

    yield * next;
  }
}


exports = module.exports = middleware;