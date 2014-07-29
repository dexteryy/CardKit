
/* @source ../../node_modules/ozjs/oz.js */;

/**
 * OzJS: microkernel for modular javascript
 * compatible with AMD (Asynchronous Module Definition)
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
(function(window, exports){

    if (!exports || window.window) {
        exports = {};
    }

    var _toString = Object.prototype.toString,
        _RE_PLUGIN = /(.*)!(.+)/,
        _RE_DEPS = /\Wrequire\((['"]).+?\1\)/g, //'
        _RE_SUFFIX = /\.(js|json)$/,
        _RE_RELPATH = /^\.+?\/.+/,
        _RE_DOT = /(^|\/)\.\//g,
        _RE_DOTS = /[^\/\.]+\/\.\.\//,
        _RE_ALIAS_IN_MID = /^([\w\-]+)\//,
        _builtin_mods = { "require": 1, "exports": 1, "module": 1, 
            "host": 1, "finish": 1 },

        _config = {
            mods: {}
        },
        _scripts = {},
        _delays = {},
        _refers = {},
        _waitings = {},
        _latest_mod,
        _scope,
        _resets = {},

        forEach = Array.prototype.forEach || function(fn, sc){
            for(var i = 0, l = this.length; i < l; i++){
                if (i in this)
                    fn.call(sc, this[i], i, this);
            }
        };

    function is_function(obj) {
        return _toString.call(obj) === "[object Function]";
    }

    function is_array(obj) {
        return _toString.call(obj) === "[object Array]";
    }

    function is_global(obj) {
        return "setInterval" in obj;
    }

    function clone(obj) { // be careful of using `delete`
        function NewObj(){}
        NewObj.prototype = obj;
        return new NewObj();
    }

    /**
     * @public define / register a module and its meta information
     * @param {string} module name. optional as unique module in a script file
     * @param {string[]} dependencies
     * @param {function} module code, execute only once on the first call
     *
     * @note
     *
     * define('', [""], func)
     * define([""], func)
     * define('', func)
     * define(func)
     *
     * define('', "")
     * define('', [""], "")
     * define('', [""])
     *
     */
    exports.define = function(name, deps, block){
        var is_remote = typeof block === 'string';
        if (!block) {
            if (deps) {
                if (is_array(deps)) {
                    block = exports.filesuffix(
                        exports.realname(
                            exports.basename(name)
                        )
                    );
                } else {
                    block = deps;
                    deps = null;
                }
            } else {
                block = name;
                name = "";
            }
            if (typeof name !== 'string') {
                deps = name;
                name = "";
            } else {
                is_remote = typeof block === 'string';
                if (!is_remote && !deps) {
                    deps = exports.seek(block);
                }
            }
        }
        name = name && exports.realname(name);
        var mod = name && _config.mods[name];
        if (!_config.debug && mod && mod.name
                && (is_remote && mod.loaded == 2 || mod.exports)) {
            return;
        }
        if (is_remote && _config.enable_ozma) {
            deps = null;
        }
        var host = is_global(this) ? this : window;
        mod = _config.mods[name] = {
            name: name,
            url: mod && mod.url,
            host: host,
            deps: deps || []
        };
        if (name === "") { // capture anonymous module
            _latest_mod = mod;
        }
        if (typeof block !== 'string') {
            mod.block = block;
            mod.loaded = 2;
        } else { // remote module
            var alias = _config.aliases;
            if (alias) {
                block = block.replace(/\{(\w+)\}/g, function(e1, e2){
                    return alias[e2] || "";
                });
            }
            mod.url = block;
        }
        if (mod.block && !is_function(mod.block)) { // json module
            mod.exports = block;
        }
    };

    exports.define.amd = {};

    /**
     * @public run a code block its dependencies
     * @param {string[]} [module name] dependencies
     * @param {function}
     */
    exports.require = function(deps, block, _self_mod) {
        if (typeof deps === 'string') {
            if (!block) {
                deps = exports.realname(exports.basename(deps, _scope));
                return (_config.mods[deps] || {}).exports;
            }
            deps = [deps];
        } else if (!block) {
            block = deps;
            deps = exports.seek(block);
        }
        var host = is_global(this) ? this : window;
        if (!_self_mod) {
            _self_mod = { url: _scope && _scope.url };
        }
        var m, remotes = 0, // counter for remote scripts
            // calculate dependencies, find all required modules
            list = exports.scan.call(host, deps, _self_mod);
        for (var i = 0, l = list.length; i < l; i++) {
            m = list[i];
            if (m.is_reset) {
                m = _config.mods[m.name];
            }
            if (m.url && m.loaded !== 2) { // remote module
                remotes++;
                m.loaded = 1; // status: loading
                exports.fetch(m, function(){
                    this.loaded = 2; // status: loaded
                    var lm = _latest_mod;
                    if (lm) { // capture anonymous module
                        lm.name = this.name;
                        lm.url = this.url;
                        _config.mods[this.name] = lm;
                        _latest_mod = null;
                    }
                    // loaded all modules, calculate dependencies all over again
                    if (--remotes <= 0) {
                        exports.require.call(host, deps, block, _self_mod);
                    }
                });
            }
        }
        if (!remotes) {
            _self_mod.deps = deps;
            _self_mod.host = host;
            _self_mod.block = block;
            setTimeout(function(){
                exports.tidy(deps, _self_mod);
                list.push(_self_mod);
                exports.exec(list.reverse());
            }, 0);
        }
    };

    exports.require.config = function(opt){
        for (var i in opt) {
            if (i === 'aliases') {
                if (!_config[i]) {
                    _config[i] = {};
                }
                for (var j in opt[i]) {
                    _config[i][j] = opt[i][j];
                }
                var mods = _config.mods;
                for (var k in mods) {
                    mods[k].name = exports.realname(k);
                    mods[mods[k].name] = mods[k];
                }
            } else {
                _config[i] = opt[i];
            }
        }
    };

    /**
     * @private execute modules in a sequence of dependency
     * @param {object[]} [module object]
     */
    exports.exec = function(list){
        var mod, mid, tid, result, isAsync, deps,
            depObjs, exportObj, moduleObj, rmod,
            wt = _waitings;
        while (mod = list.pop()) {
            if (mod.is_reset) {
                rmod = clone(_config.mods[mod.name]);
                rmod.host = mod.host;
                rmod.newname = mod.newname;
                mod = rmod;
                if (!_resets[mod.newname]) {
                    _resets[mod.newname] = [];
                }
                _resets[mod.newname].push(mod);
                mod.exports = undefined;
            } else if (mod.name) {
                mod = _config.mods[mod.name] || mod;
            }
            if (!mod.block || !mod.running && mod.exports !== undefined) {
                continue;
            }
            depObjs = [];
            exportObj = {}; // for "exports" module
            moduleObj = { id: mod.name, filename: mod.url, exports: exportObj };
            deps = mod.deps.slice();
            deps[
                mod.block.hiddenDeps ? 'unshift' : 'push'
            ]("require", "exports", "module");
            for (var i = 0, l = deps.length; i < l; i++) {
                mid = deps[i];
                switch(mid) {
                    case 'require':
                        depObjs.push(exports.require);
                        break;
                    case 'exports':
                        depObjs.push(exportObj);
                        break;
                    case 'module':
                        depObjs.push(moduleObj);
                        break;
                    case 'host': // deprecated
                        depObjs.push(mod.host);
                        break;
                    case 'finish':  // execute asynchronously
                        tid = mod.name;
                        if (!wt[tid]) // for delay execute
                            wt[tid] = [list];
                        else
                            wt[tid].push(list);
                        depObjs.push(function(result){
                            // HACK: no guarantee that this function will be invoked 
                            //       after while() loop termination in Chrome/Safari
                            setTimeout(function(){
                                // 'mod' equal to 'list[list.length-1]'
                                if (result !== undefined) {
                                    mod.exports = result;
                                }
                                if (!wt[tid])
                                    return;
                                forEach.call(wt[tid], function(list){
                                    this(list);
                                }, exports.exec);
                                delete wt[tid];
                                mod.running = 0;
                            }, 0);
                        });
                        isAsync = 1;
                        break;
                    default:
                        depObjs.push((
                            (_resets[mid] || []).pop()
                            || _config.mods[exports.realname(mid)]
                            || {}
                        ).exports);
                        break;
                }
            }
            if (!mod.running) {
                // execute module code. arguments: 
                // [dep1, dep2, ..., require, exports, module]
                _scope = mod;
                result = mod.block.apply(mod.host, depObjs) || null;
                _scope = false;
                exportObj = moduleObj.exports;
                mod.exports = result !== undefined ? result 
                    : exportObj; // use empty exportObj for "finish"
                for (var v in exportObj) {
                    if (v) {
                        mod.exports = exportObj;
                    }
                    break;
                }
            }
            if (isAsync) { // skip, wait for finish()
                mod.running = 1;
                return false;
            }
        }
        return true;
    };

    /**
     * @private observer for script loader, prevent duplicate requests
     * @param {object} module object
     * @param {function} callback
     */
    exports.fetch = function(m, cb){
        var url = m.url,
            observers = _scripts[url];
        if (!observers) {
            var mname = m.name, delays = _delays;
            if (m.deps && m.deps.length && delays[mname] !== 1) {
                delays[mname] = [m.deps.length, cb];
                forEach.call(m.deps, function(dep){
                    var d = _config.mods[exports.realname(dep)];
                    if (this[dep] !== 1 && d.url && d.loaded !== 2) {
                        if (!this[dep]) {
                            this[dep] = [];
                        }
                        this[dep].push(m);
                    } else {
                        delays[mname][0]--;
                    }
                }, _refers);
                if (delays[mname][0] > 0) {
                    return;
                } else {
                    delays[mname] = 1;
                }
            }
            observers = _scripts[url] = [[cb, m]];
            var true_url = /^\w+:\/\//.test(url) ? url
                : (_config.enable_ozma && _config.distUrl || _config.baseUrl || '')
                    + (_config.enableAutoSuffix ? exports.namesuffix(url) : url);
            exports.load.call(m.host || window, true_url, function(){
                forEach.call(observers, function(args){
                    args[0].call(args[1]);
                });
                _scripts[url] = 1;
                if (_refers[mname] && _refers[mname] !== 1) {
                    forEach.call(_refers[mname], function(dm){
                        var b = this[dm.name];
                        if (--b[0] <= 0) {
                            this[dm.name] = 1;
                            exports.fetch(dm, b[1]);
                        }
                    }, delays);
                    _refers[mname] = 1;
                }
            });
        } else if (observers === 1) {
            cb.call(m);
        } else {
            observers.push([cb, m]);
        }
    };

    /**
     * @public non-blocking script loader
     * @param {string}
     * @param {object} config
     */
    exports.load = function(url, op){
        var doc = is_global(this) ? this.document : window.document,
            s = doc.createElement("script");
        s.type = "text/javascript";
        s.async = "async"; //for firefox3.6
        if (!op)
            op = {};
        else if (is_function(op))
            op = { callback: op };
        if (op.charset)
            s.charset = op.charset;
        s.src = url;
        var h = doc.getElementsByTagName("head")[0];
        s.onload = s.onreadystatechange = function(__, isAbort){
            if (isAbort 
                    || !s.readyState 
                    || /loaded|complete/.test(s.readyState)) {
                s.onload = s.onreadystatechange = null;
                if (h && s.parentNode) {
                    h.removeChild(s);
                }
                s = undefined;
                if (!isAbort && op.callback) {
                    op.callback();
                }
            }
        };
        h.insertBefore(s, h.firstChild);
    };

    /**
     * @private search and sequence all dependencies, based on DFS
     * @param {string[]} a set of module names
     * @param {object[]}
     * @param {object[]} a sequence of modules, for recursion
     * @return {object[]} a sequence of modules
     */
    exports.scan = function(m, file_mod, list){
        list = list || [];
        if (!m[0]) {
            return list;
        }
        var deps,
            history = list.history;
        if (!history) {
            history = list.history = {};
        }
        if (m[1]) {
            deps = m;
            m = false;
        } else {
            var truename,
                _mid = m[0],
                plugin = _RE_PLUGIN.exec(_mid);
            if (plugin) {
                _mid = plugin[2];
                plugin = plugin[1];
            }
            var mid = exports.realname(_mid);
            if (!_config.mods[mid] && !_builtin_mods[mid]) {
                var true_mid = exports.realname(exports.basename(_mid, file_mod));
                if (mid !== true_mid) {
                    _config.mods[file_mod.url + ':' + mid] = true_mid;
                    mid = true_mid;
                }
                if (!_config.mods[true_mid]) {
                    exports.define(true_mid, exports.filesuffix(true_mid));
                }
            }
            m = file_mod = _config.mods[mid];
            if (m) {
                if (plugin === "new") {
                    m = {
                        is_reset: true,
                        deps: m.deps,
                        name: mid,
                        newname: plugin + "!" + mid,
                        host: this
                    };
                } else {
                    truename = m.name;
                }
                if (history[truename]) {
                    return list;
                }
            } else {
                return list;
            }
            if (!history[truename]) {
                deps = m.deps || [];
                // find require information within the code
                // for server-side style module
                //deps = deps.concat(seek(m));
                if (truename) {
                    history[truename] = true;
                }
            } else {
                deps = [];
            }
        }
        for (var i = deps.length - 1; i >= 0; i--) {
            if (!history[deps[i]]) {
                exports.scan.call(this, [deps[i]], file_mod, list);
            }
        }
        if (m) {
            exports.tidy(deps, m);
            list.push(m);
        }
        return list;
    };

    /**
     * @experiment
     * @private analyse module code
     *          to find out dependencies which have no explicit declaration
     * @param {object} module object
     */
    exports.seek = function(block){
        var hdeps = block.hiddenDeps || [];
        if (!block.hiddenDeps) {
            var code = block.toString(),
                h = null;
            hdeps = block.hiddenDeps = [];
            while (h = _RE_DEPS.exec(code)) {
                hdeps.push(h[0].slice(10, -2));
            }
        }
        return hdeps.slice();
    };

    exports.tidy = function(deps, m){
        forEach.call(deps.slice(), function(dep, i){
            var true_mid = this[m.url + ':' + exports.realname(dep)];
            if (typeof true_mid === 'string') {
                deps[i] = true_mid;
            }
        }, _config.mods);
    };

    /**
     * @note naming pattern:
     * _g_src.js
     * _g_combo.js
     *
     * jquery.js
     * jquery_pack.js
     *
     * _yy_src.pack.js
     * _yy_combo.js
     *
     * _yy_bak.pack.js
     * _yy_bak.pack_pack.js
     */
    exports.namesuffix = function(file){
        return file.replace(/(.+?)(_src.*)?(\.\w+)$/, function($0, $1, $2, $3){
            return $1 + ($2 && '_combo' || '_pack') + $3;
        });
    };

    exports.filesuffix = function(mid){
        return _RE_SUFFIX.test(mid) ? mid : mid + '.js';
    };

    exports.realname = function(mid){
        var alias = _config.aliases;
        if (alias) {
            mid = mid.replace(_RE_ALIAS_IN_MID, function(e1, e2){
                var path = alias[e2];
                if (!path || mid.indexOf(path) === 0) {
                    return e2 + '/';
                }
                return path;
            });
        }
        return mid;
    };

    exports.basename = function(mid, file_mod){
        var rel_path = _RE_RELPATH.exec(mid);
        if (rel_path && file_mod) { // resolve relative path in Module ID
            mid = (file_mod.url || '').replace(/[^\/]+$/, '') + rel_path[0];
        }
        return exports.resolvename(mid);
    };

    exports.resolvename = function(url){
        url = url.replace(_RE_DOT, '$1');
        while (_RE_DOTS.test(url)) {
            url = url.replace(_RE_DOTS, '/').replace(/(^|[^:])\/\/+/g, '$1/');
        }
        return url.replace(/^\//, '');
    };

    var origin = {};
    for (var i in exports) {
        origin[i] = exports[i];
    }

    exports.origin = origin;
    exports.cfg = _config;

    window.oz = exports;
    window.define = exports.define;
    window.require = exports.require;

})(this, typeof exports !== 'undefined' && exports);

require.config({ enable_ozma: true });


/* @source mo/lang/es5.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/lang/es5", [], function(){

    var host = this,
        Array = host.Array,
        String = host.String,
        Object = host.Object,
        Function = host.Function,
        //window = host.window,
        _objproto = Object.prototype,
        _arrayproto = Array.prototype,
        _fnproto = Function.prototype;

    function Empty() {}

    if (!_fnproto.bind) {
        _fnproto.bind = function (that) {
            var target = this,
                args = _arrayproto.slice.call(arguments, 1),
                bound = function () {
                    var arglist = args.concat(_arrayproto.slice.call(arguments));
                    if (this instanceof bound) {
                        var result = target.apply(this, arglist);
                        if (Object(result) === result) {
                            return result;
                        }
                        return this;
                    } else {
                        return target.apply(that, arglist);
                    }
                };
            if(target.prototype) {
                Empty.prototype = target.prototype;
                bound.prototype = new Empty();
                Empty.prototype = null;
            }
            return bound;
        };
    }

    var _call = _fnproto.call,
        _hasOwnProperty = _call.bind(_objproto.hasOwnProperty),
        _toString = _call.bind(_objproto.toString);

    if (!_arrayproto.filter) {
        _arrayproto.filter = function(fn, sc){
            var r = [];
            for (var i = 0, l = this.length; i < l; i++){
                if (i in this && fn.call(sc, this[i], i, this)) {
                    r.push(this[i]);
                }
            }
            return r;
        };
    }
        
    if (!_arrayproto.forEach) {
        _arrayproto.forEach = function(fn, sc){
            for(var i = 0, l = this.length; i < l; i++){
                if (i in this)
                    fn.call(sc, this[i], i, this);
            }
        };
    }

    if (!_arrayproto.map) {
        _arrayproto.map = function(fn, sc){
            for (var i = 0, copy = [], l = this.length; i < l; i++) {
                if (i in this) {
                    copy[i] = fn.call(sc, this[i], i, this);
                }
            }
            return copy;
        };
    }

    if (!_arrayproto.reduce) {
        _arrayproto.reduce = function(fn, sc){
            for (var i = 1, prev = this[0], l = this.length; i < l; i++) {
                if (i in this) {
                    prev = fn.call(sc, prev, this[i], i, this);
                }
            }
            return prev;
        };
    }

    if (!_arrayproto.some) {
        _arrayproto.some = function(fn, sc){
            for (var i = 0, l = this.length; i < l; i++){
                if (i in this && fn.call(sc, this[i], i, this)) {
                    return true;
                }
            }
            return false;
        };
    }

    if (!_arrayproto.every) {
        _arrayproto.every = function(fn, sc){
            for (var i = 0, l = this.length; i < l; i++){
                if (i in this && !fn.call(sc, this[i], i, this)) {
                    return false;
                }
            }
            return true;
        };
    }

    if (!_arrayproto.indexOf) {
        _arrayproto.indexOf = function(elt, from){
            var l = this.length;
            from = parseInt(from, 10) || 0;
            if (from < 0)
                from += l;
            for (; from < l; from++) {
                if (from in this && this[from] === elt)
                    return from;
            }
            return -1;
        };
    }

    if (!_arrayproto.lastIndexOf) {
        _arrayproto.lastIndexOf = function(elt, from){
            var l = this.length;
            from = parseInt(from, 10) || l - 1;
            if (from < 0)
                from += l;
            for (; from > -1; from--) {
                if (from in this && this[from] === elt)
                    return from;
            }
            return -1;
        };
    }

    if (!Array.isArray) {
        Array.isArray = function(obj) {
            return _toString(obj) === "[object Array]";
        };
    }

    var rnotwhite = /\S/,
        trimLeft = /^\s+/,
        trimRight = /\s+$/;
    if (rnotwhite.test( "\xA0")) {
        trimLeft = /^[\s\xA0]+/;
        trimRight = /[\s\xA0]+$/;
    }
    if (!String.prototype.trim) {
        String.prototype.trim = function() {
            return this.replace(trimLeft, "").replace(trimRight, "");
        };
    }

    if (!Object.keys) {
        Object.keys = function(obj) {
            var keys = [];
            for (var prop in obj) {
                if (_hasOwnProperty(obj, prop)) {
                    keys.push(prop);
                }
            }
            return keys;
        };
    }

    if (!Object.create) {
        Object.create = function(obj) {
            function NewObj(){}
            NewObj.prototype = obj;
            return new NewObj();
        };
    }

    if (!Object.getPrototypeOf) {
        Object.getPrototypeOf = function (obj) {
            return obj.__proto__ || obj.constructor.prototype;
        };
    }
    
});

/* @source mo/lang/type.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/lang/type", [
  "mo/lang/es5"
], function(_0, require, exports){

    var _toString = Object.prototype.toString,
        _aproto = Array.prototype,
        _typeMap = {};

    _aproto.forEach.call("Boolean Number String Function Array Date RegExp Object".split(" "), function(name){
        this[ "[object " + name + "]" ] = name.toLowerCase();
    }, _typeMap);

    function type(obj) {
        return obj == null ?
            String(obj) :
            _typeMap[ _toString.call(obj) ] || "object";
    }

    exports.type = type;

    exports.isFunction = function(obj) {
        return _toString.call(obj) === "[object Function]";
    };

    exports.isWindow = function(obj) {
		return obj && obj === obj.window;
    };

	exports.isEmptyObject = function(obj) {
        for (var name in obj) {
            name = null;
            return false;
        }
        return true;
	};

    exports.isArraylike = function(obj){
        var l = obj.length;
        return !exports.isWindow(obj) 
            && (typeof obj !== 'function' 
                || obj.constructor !== Function)
            && (l === 0 
                || typeof l === "number"
                && l > 0 
                && (l - 1) in obj);
    };

});

/* @source mo/lang/mix.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/lang/mix", [
  "mo/lang/es5",
  "mo/lang/type"
], function(_0, _, require, exports){

    var type = _.type;

    function mix(origin) {
        var objs = arguments, ol = objs.length, 
            VALTYPE = { 'number': 1, 'boolean': 2, 'string': 3 },
            obj, lvl, i, l;
        if (typeof objs[ol - 1] !== 'object') {
            lvl = objs[ol - 1] || 0;
            ol--;
        } else {
            lvl = 0;
        }
        for (var n = 1; n < ol; n++) {
            obj = objs[n];
            if (Array.isArray(obj)) {
                origin = !VALTYPE[typeof origin] && origin || [];
                l = obj.length;
                for (i = 0; i < l; i++) {
                    if (lvl >= 1 && obj[i] && typeof obj[i] === 'object') {
                        origin[i] = mix(origin[i], obj[i], lvl - 1);
                    } else {
                        origin[i] = obj[i];
                    }
                }
            } else {
                origin = !VALTYPE[typeof origin] && origin || {};
                for (i in obj) {
                    if (lvl >= 1 && obj[i] && typeof obj[i] === 'object') {
                        origin[i] = mix(origin[i], obj[i], lvl - 1);
                    } else {
                        origin[i] = obj[i];
                    }
                }
            }
        }
        return origin;
    }

    function merge(origin) {
        var objs = arguments, ol = objs.length, 
            ITERTYPE = { 'object': 1, 'array': 2 },
            obj, lvl, i, k, lib, marked, mark;
        if (typeof objs[ol - 1] !== 'object') {
            lvl = objs[ol - 1] || 0;
            ol--;
        } else {
            lvl = 0;
        }
        for (var n = 1; n < ol; n++) {
            obj = objs[n];
            if (typeof obj !== 'object') {
                continue;
            }
            if (Array.isArray(origin)) {
                if (!Array.isArray(obj)) {
                    continue;
                }
                origin = origin || [];
                lib = {};
                marked = [];
                mark = '__oz_uniqmark_' + (+new Date() + Math.random());
                obj = obj.concat(origin);
                origin.length = 0;
                obj.forEach(function(i){
                    if (i && typeof i === 'object') {
                        if (!i[mark]) {
                            if (lvl >= 1 && Array.isArray(i)) {
                                origin.push(merge(i, [], lvl - 1));
                            } else {
                                origin.push(i);
                            }
                            i[mark] = 1;
                            marked.push(i);
                        }
                    } else {
                        k = (typeof i) + '_' + i;
                        if (!this[k]) {
                            origin.push(i);
                            this[k] = 1;
                        }
                    }
                }, lib);
                marked.forEach(function(i){
                    delete i[mark];
                });
            } else {
                origin = origin || {};
                for (i in obj) {
                    if (!origin.hasOwnProperty(i)) {
                        origin[i] = obj[i];
                    } else if (lvl >= 1 && i 
                            // avoid undefined === undefined
                            && ITERTYPE[type(origin[i])] + 0 === ITERTYPE[type(obj[i])] + 0) {
                        origin[i] = merge(origin[i], obj[i], lvl - 1);
                    }
                }
            }
        }
        return origin;
    }

    function interset(origin) {
        var objs = arguments, ol = objs.length, 
            ITERTYPE = { 'object': 1, 'array': 2 },
            obj, lvl, i, k, lib, marked, mark;
        if (typeof objs[ol - 1] !== 'object') {
            lvl = objs[ol - 1] || 0;
            ol--;
        } else {
            lvl = 0;
        }
        for (var n = 1; n < ol; n++) {
            obj = objs[n];
            if (typeof obj !== 'object') {
                continue;
            }
            if (Array.isArray(origin)) {
                if (!Array.isArray(obj)) {
                    continue;
                }
                origin = origin || [];
                lib = {};
                marked = [];
                mark = '__oz_uniqmark_' + (+new Date() + Math.random());
                origin.forEach(function(i){
                    if (i && typeof i === 'object' && !i[mark]) {
                        i[mark] = 1;
                        marked.push(i);
                    } else {
                        k = (typeof i) + '_' + i;
                        this[k] = 1;
                    }
                }, lib);
                origin.length = 0;
                obj.forEach(function(i){
                    if (i && typeof i === 'object') {
                        if (i[mark] === 1) {
                            origin.push(i);
                            i[mark] = 2;
                        }
                    } else {
                        k = (typeof i) + '_' + i;
                        if (this[k] === 1) {
                            origin.push(i);
                            this[k] = 2;
                        }
                    }
                }, lib);
                marked.forEach(function(i){
                    delete i[mark];
                });
            } else {
                origin = origin || {};
                for (i in origin) {
                    if (!obj.hasOwnProperty(i)) {
                        delete origin[i];
                    } else if (lvl >= 1 && i 
                            && ITERTYPE[type(origin[i])] + 0 === ITERTYPE[type(obj[i])] + 0) {
                        origin[i] = interset(origin[i], obj[i], lvl - 1);
                    }
                }
            }
        }
        return origin;
    }

    exports.mix = mix;
    exports.merge = merge;
    exports.interset = interset;

    exports.copy = function(obj, lvl) {
        return mix(null, obj, lvl);
    };

    exports.occupy = function(origin, obj, lvl) {
        return mix(interset(origin, obj, lvl), obj, lvl);
    };

    exports.defaults = merge;

    exports.config = function(cfg, opt, default_cfg, lvl){
        return mix(merge(cfg, default_cfg, lvl), interset(mix(null, opt, lvl), default_cfg, lvl), lvl);
    };

    exports.unique = function(origin, lvl) {
        return merge(origin, [], lvl);
    };

    exports.each = function(obj, fn, context){
        var i = 0, l = obj.length, re;
        if (_.isArraylike(obj)) {
            for (; i < l; i++) {
                re = fn.call(context, obj[i], i);
                if (re === false) {
                    break;
                }
            }
        } else {
            for (i in obj) {
                re = fn.call(context, obj[i], i);
                if (re === false) {
                    break;
                }
            }
        }
        return obj;
    };

});


/* @source mo/lang/struct.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/lang/struct", [
  "mo/lang/es5",
  "mo/lang/mix"
], function(_0, _, require, exports){

    var mix = _.mix;

    exports.index = function(list, key) {
        var obj = {}, item;
        for (var i = 0, l = list.length; i < l; i++) {
            item = list[i];
            if (key && typeof item === 'object') {
                obj[item[key]] = item;
            } else {
                obj[item] = true;
            }
        }
        return obj;
    };

    exports.fnQueue = function(){
        var queue = [], dup = false;
        function getCallMethod(type){
            return function(){
                var re, fn;
                dup = this.slice().reverse();
                while (fn = dup.pop()) {
                    re = fn[type].apply(fn, arguments);
                }
                dup = false;
                return re;
            };
        }
        mix(queue, {
            call: getCallMethod('call'),
            apply: getCallMethod('apply'),
            clear: function(func){
                if (!func) {
                    this.length = 0;
                } else {
                    var size = this.length,
                        popsize = size - dup.length;
                    for (var i = this.length - 1; i >= 0; i--) {
                        if (this[i] === func) {
                            this.splice(i, 1);
                            if (dup && i >= popsize)
                                dup.splice(size - i - 1, 1);
                        }
                    }
                    if (i < 0)
                        return false;
                }
                return true;
            }
        });
        return queue;
    };

});


/* @source eventmaster.js */;

/**
 * EventMaster
 * A simple, compact and consistent implementation of a variant of CommonJS's Promises and Events
 * Provide both Promise/Deferred/Flow pattern and Event/Notify/Observer/PubSub pattern
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("eventmaster", [
  "mo/lang/es5",
  "mo/lang/mix",
  "mo/lang/struct"
], function(es5, _, struct){

    var fnQueue = struct.fnQueue,
        slice = Array.prototype.slice,
        pipes = ['notify', 'fire', 'error', 
            'resolve', 'reject', 'reset', 'disable', 'enable'];

    function Promise(opt){
        var self = this;
        if (opt) {
            this.subject = opt.subject;
            this.trace = opt.trace;
            this.traceStack = opt.traceStack || [];
        }
        this.doneHandlers = fnQueue();
        this.failHandlers = fnQueue();
        this.observeHandlers = fnQueue();
        this._alterQueue = fnQueue();
        this._lastDoneQueue = [];
        this._lastFailQueue = [];
        this.status = 0;
        this._argsCache = [];
        this.pipe = {};
        pipes.forEach(function(i){
            this[i] = function(){
                return self[i].call(self, slice.call(arguments));
            };
        }, this.pipe);
    }

    var actors = Promise.prototype = {

        then: function(handler, errorHandler){
            var _status = this.status;
            if (errorHandler) { // error, reject
                if (_status === 2) {
                    this._resultCache = errorHandler.apply(this, this._argsCache);
                } else if (!_status) {
                    this.failHandlers.push(errorHandler);
                    this._lastFailQueue = this.failHandlers;
                }
            } else {
                this._lastFailQueue = [];
            }
            if (handler) { // fire, resolve
                if (_status === 1) {
                    this._resultCache = handler.apply(this, this._argsCache);
                } else if (!_status) {
                    this.doneHandlers.push(handler);
                    this._lastDoneQueue = this.doneHandlers;
                }
            } else {
                this._lastDoneQueue = [];
            }
            return this;
        },

        done: function(handler){ // fire, resolve
            return this.then(handler);
        },

        fail: function(handler){ // error, reject
            return this.then(false, handler);
        },

        cancel: function(handler, errorHandler){ // then
            if (handler) { // done
                this.doneHandlers.clear(handler);
            }
            if (errorHandler) { // fail
                this.failHandlers.clear(errorHandler);
            }
            return this;
        },

        bind: function(handler){
            if (this.status) { // resolve, reject
                handler.apply(this, this._argsCache);
            }
            this.observeHandlers.push(handler); // notify, fire, error
            return this;
        },

        unbind: function(handler){ // bind
            this.observeHandlers.clear(handler);
            return this;
        },

        progress: function(handler){ // notify, fire?, error?
            var self = this;
            this.observeHandlers.push(function(){
                if (!self.status) {
                    handler.apply(this, arguments);
                }
            });
            return this;
        },

        notify: function(args){ // progress, bind
            if (this._disalbed) {
                return this;
            }
            this.status = 0;
            this.observeHandlers.apply(this, args || []);
            return this;
        },

        fire: function(args){ // bind, progress?, then, done
            if (this._disalbed) {
                return this;
            }
            if (this.trace) {
                this._trace();
            }
            args = args || [];
            var onceHandlers = this.doneHandlers;
            this.doneHandlers = this._alterQueue;
            this.failHandlers.length = 0;
            this.observeHandlers.apply(this, args);
            onceHandlers.apply(this, args);
            onceHandlers.length = 0;
            this._alterQueue = onceHandlers;
            return this;
        },

        error: function(args){ // bind, progress?, then, fail 
            if (this._disalbed) {
                return this;
            }
            if (this.trace) {
                this._trace();
            }
            args = args || [];
            var onceHandlers = this.failHandlers;
            this.failHandlers = this._alterQueue;
            this.doneHandlers.length = 0;
            this.observeHandlers.apply(this, args);
            onceHandlers.apply(this, args);
            onceHandlers.length = 0;
            this._alterQueue = onceHandlers;
            return this;
        },

        resolve: function(args){ // bind, then, done 
            this.status = 1;
            this._argsCache = args || [];
            return this.fire(args);
        },

        reject: function(args){ // bind, then, fail 
            this.status = 2;
            this._argsCache = args || [];
            return this.error(args);
        },

        reset: function(){ // resolve, reject
            this.status = 0;
            this._argsCache = [];
            this.doneHandlers.length = 0;
            this.failHandlers.length = 0;
            return this;
        },

        disable: function(){
            this._disalbed = true;
        },

        enable: function(){
            this._disalbed = false;
        },

        merge: function(promise){ // @TODO need testing
            _.merge(this.doneHandlers, promise.doneHandlers);
            _.merge(this.failHandlers, promise.failHandlers);
            _.merge(this.observeHandlers, promise.observeHandlers);
            var subject = promise.subject;
            _.mix(promise, this);
            promise.subject = subject;
        },

        _trace: function(){
            this.traceStack.unshift(this.subject);
            if (this.traceStack.length > this.trace) {
                this.traceStack.pop();
            }
        },

        follow: function(){
            var next = new Promise();
            next._prevActor = this;
            if (this.status) {
                pipe(this._resultCache, next);
            } else {
                var doneHandler = this._lastDoneQueue.pop();
                if (doneHandler) {
                    this._lastDoneQueue.push(function(){
                        return pipe(doneHandler.apply(this, arguments), next);
                    });
                }
                var failHandler = this._lastFailQueue.pop();
                if (failHandler) {
                    this._lastFailQueue.push(function(){
                        return pipe(failHandler.apply(this, arguments), next);
                    });
                }
            }
            return next;
        },

        end: function(){
            return this._prevActor;
        },

        all: function(){
            var fork = when.apply(this, this._when);
            return fork;
        },

        any: function(){
            var fork = when.apply(this, this._when);
            fork._count = fork._total = 1;
            return fork;
        },

        some: function(n){
            var fork = when.apply(this, this._when);
            fork._count = fork._total = n;
            return fork;
        }

    };

    function when(){
        var mutiArgs = [],
            completed = [],
            mutiPromise = new Promise();
        mutiPromise._when = [];
        mutiPromise._count = mutiPromise._total = arguments.length;
        Array.prototype.forEach.call(arguments, function(promise, i){
            var mutiPromise = this;
            mutiPromise._when.push(promise.bind(callback));
            function callback(args){
                if (!completed[i]) {
                    completed[i] = true;
                    mutiArgs[i] = args;
                    if (--mutiPromise._count === 0) {  // @TODO
                        completed.length = 0;
                        mutiPromise._count = mutiPromise._total;
                        mutiPromise.resolve.call(mutiPromise, mutiArgs);
                    }
                }
            }
        }, mutiPromise);
        return mutiPromise;
    }

    function pipe(prev, next){
        if (prev && prev.then) {
            prev.then(next.pipe.resolve, next.pipe.reject)
                .progress(next.pipe.notify);
        } else if (prev !== undefined) {
            next.resolve([prev]);
        }
        return prev;
    }

    function dispatchFactory(i){
        return function(subject){
            var promise = this.lib[subject];
            if (!promise) {
                promise = this.lib[subject] = new Promise({
                    subject: subject,
                    trace: this.trace,
                    traceStack: this.traceStack
                });
            }
            promise[i].apply(promise, slice.call(arguments, 1));
            return this;
        };
    }

    function Event(opt){
        if (opt) {
            this.trace = opt.trace;
            this.traceStack = opt.traceStack;
        }
        this.lib = {};
    }

    var EventAPI = Event.prototype = (function(methods){
        for (var i in actors) {
            methods[i] = dispatchFactory(i);
        }
        return methods;
    })({});

    EventAPI.once = EventAPI.wait = EventAPI.then;
    EventAPI.on = EventAPI.bind;
    EventAPI.off = EventAPI.unbind;

    EventAPI.promise = function(subject){
        var promise = this.lib[subject];
        if (!promise) {
            promise = this.lib[subject] = new Promise({
                subject: subject,
                trace: this.trace,
                traceStack: this.traceStack
            });
        }
        return promise;
    };

    EventAPI.when = function(){
        var args = [];
        for (var i = 0, l = arguments.length; i < l; i++) {
            args.push(this.promise(arguments[i]));
        }
        return when.apply(this, args);
    };

    function exports(opt){
        return new Event(opt);
    }

    exports.Promise = Promise;
    exports.Event = Event;
    exports.when = when;
    exports.pipe = pipe;

    exports.VERSION = '2.1.0';

    return exports;
});

/* @source cardkit/bus.js */;


define("cardkit/bus", [
  "eventmaster"
], function(event){

    return event();

});


/* @source mo/browsers.js */;

/**
 * Standalone jQuery.browsers supports skin browsers popular in China 
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/browsers", [], function(){

    var match, skin, os, is_mobile_webkit, is_touch, is_webview,
        ua = this.navigator.userAgent.toLowerCase(),
        rank = { 
            "360ee": 2,
            "maxthon/3": 2,
            "qqbrowser": 2,
            "metasr": 2,
            "360se": 1,
            "theworld": 1,
            "maxthon": 1,
            "tencenttraveler": -1
        };

    try {
        var rwindows = /(windows) nt ([\w.]+)/,
            rmac = /(mac) os \w+ ([\w.]+)/,
            rwindowsphone = /(windows phone)[\sos]* ([\w.]+)/,
            riphone = /(iphone).*? os ([\w.]+)/,
            ripad = /(ipad).*? os ([\w.]+)/,
            randroid = /(android)[ ;]([\w.]*)/,
            rmobilewebkit = /(\w+)[ \/]([\w.]+)[ \/]mobile/,
            rsafari = /(\w+)[ \/]([\w.]+)[ \/]safari/,
            rmobilesafari = /[ \/]mobile.*safari/,
            rwebview = /[ \/]mobile/,
            rtouch = / touch/,
            rwebkit = /(webkit)[ \/]([\w.]+)/,
            ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/,
            rmsie = /(msie) ([\w.]+)/,
            rie11 = /(trident).*? rv:([\w.]+)/,
            rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;

        var r360se = /(360se)/,
            r360ee = /(360ee)/,
            r360phone = /(360) \w+phone/,
            rtheworld = /(theworld)/,
            rmaxthon3 = /(maxthon\/3)/,
            rmaxthon = /(maxthon)/,
            rtt = /(tencenttraveler)/,
            rqq = /(qqbrowser)/,
            rbaidu = /(baidubrowser)/,
            ruc = /(ucbrowser)/,
            rsogou = /(sogou\w*browser)/,
            rmetasr = /(metasr)/;

        os = riphone.exec(ua) 
            || ripad.exec(ua) 
            || randroid.exec(ua) 
            || rmac.exec(ua) 
            || rwindowsphone.exec(ua) 
            || rwindows.exec(ua) 
            || [];

        skin = r360se.exec(ua) 
            || r360ee.exec(ua) 
            || r360phone.exec(ua) 
            || ruc.exec(ua) 
            || rtheworld.exec(ua) 
            || rmaxthon3.exec(ua) 
            || rmaxthon.exec(ua) 
            || rtt.exec(ua) 
            || rqq.exec(ua) 
            || rbaidu.exec(ua) 
            || rsogou.exec(ua) 
            || rmetasr.exec(ua) 
            || [];

        match =  rwebkit.exec(ua) 
            || ropera.exec(ua) 
            || rmsie.exec(ua) 
            || rie11.exec(ua)
            || ua.indexOf("compatible") < 0 && rmozilla.exec(ua) 
            || [];

        is_mobile_webkit = rmobilesafari.exec(ua) 
            || (is_webview = rwebview.exec(ua));

        is_touch = rtouch.exec(ua);

        if (match[1] === 'trident') {
            match[1] = 'msie';
        }

        if (match[1] === 'webkit') {
            var vendor = (is_mobile_webkit ? rmobilewebkit.exec(ua)
                : rsafari.exec(ua)) || [];
            match[3] = match[1];
            match[4] = match[2];
            match[1] = vendor[1] === 'version' 
                && ((os[1] === 'iphone' 
                        || os[1] === 'ipad')
                        && 'mobilesafari'
                    || os[1] === 'android' 
                        && 'aosp' 
                    || 'safari')
                || skin[1]
                || is_webview && 'webview'
                || vendor[1];
            match[2] = vendor[2];
        }

    } catch (ex) {
        match = [];
        skin = [];
    }

    var result = { 
        browser: match[1] || skin[1] || "", 
        version: match[2] || "0",
        engine: match[3],
        engineversion: match[4] || "0",
        os: os[1],
        osversion: os[2] || "0",
        isMobile: os[1] === 'iphone'
            || os[1] === 'windows phone'
            || os[1] === 'android' && !!is_mobile_webkit,
        isTouch: os[1] === 'iphone'
            || os[1] === 'windows phone'
            || os[1] === 'android'
            || os[1] === 'windows' && is_touch,
        skin: skin[1] || "",
        ua: ua
    };

    if (match[1]) {
        result[match[1]] = parseInt(result.version, 10) || true;
    }
    if (skin[1]) {
        result.rank = rank[result.skin] || 0;
    }
    result.shell = result.skin;

    return result;

});

/* @source cardkit/supports.js */;


define("cardkit/supports", [
  "mo/browsers"
], function(browsers){

    var exports = {
        touch: browsers.isTouch,
        webview: browsers.webview,
        noBugWhenFixed: browsers.os !== 'android'
            || browsers.shell !== 'ucbrowser'
    };

    return exports;

});


/* @source mo/template/string.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/template/string", [], function(require, exports){

    exports.format = function(tpl, op){
        return tpl.replace(/\{\{(\w+)\}\}/g, function(e1,e2){
            return op[e2] != null ? op[e2] : "";
        });
    };

    exports.escapeHTML = function(str){
        str = str || '';
        var xmlchar = {
            //"&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;",
            "{": "&#123;",
            "}": "&#125;",
            "@": "&#64;"
        };
        return str.replace(/[<>'"\{\}@]/g, function($1){
            return xmlchar[$1];
        });
    };

    exports.substr = function(str, limit, cb){
        if(!str || typeof str !== "string")
            return '';
        var sub = str.substr(0, limit).replace(/([^\x00-\xff])/g, '$1 ').substr(0, limit).replace(/([^\x00-\xff])\s/g, '$1');
        return cb ? cb.call(sub, sub) : (str.length > sub.length ? sub + '...' : sub);
    };

    exports.strsize = function(str){
        return str.replace(/([^\x00-\xff]|[A-Z])/g, '$1 ').length;
    };

});


/* @source dollar/origin.js */;

/**
 * DollarJS
 * A jQuery-compatible and non-All-in-One library which is more "Zepto" than Zepto.js
 * Focus on DOM operations and mobile platform, wrap native API wherever possible.
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("dollar/origin", [
  "mo/lang/es5",
  "mo/lang/mix",
  "mo/lang/type"
], function(es5, _, detect){

var window = this,
    doc = window.document,
    NEXT_SIB = 'nextElementSibling',
    PREV_SIB = 'previousElementSibling',
    FIRST_CHILD = 'firstElementChild',
    MATCHES_SELECTOR = [
        'webkitMatchesSelector', 
        'mozMatchesSelector', 
        'msMatchesSelector', 
        'matchesSelector'
    ].map(function(name){
        return this[name] && name;
    }, doc.body).filter(pick)[0],
    MOUSE_EVENTS = { click: 1, mousedown: 1, mouseup: 1, mousemove: 1 },
    TOUCH_EVENTS = { touchstart: 1, touchmove: 1, touchend: 1, touchcancel: 1 },
    SPECIAL_TRIGGERS = { submit: 1, focus: 1, blur: 1 },
    CSS_NUMBER = {
        'column-count': 1,
        'columns': 1,
        'font-weight': 1,
        'line-height': 1,
        'opacity': 1,
        'z-index': 1,
        'zoom': 1
    },
    RE_HTMLTAG = /^\s*<(\w+|!)[^>]*>/,
    RE_ID_SEL = /^#[\w_]+$/,
    RE_CSS_NAME = /-+(.)?/g,
    RE_CAMEL = /([a-z\d])([A-Z])/g,
    RE_CAMEL_BEGIN_WITH_CAP = /([A-Z]+)([A-Z][a-z])/g,
    RE_DOUBLE_COLON = /::/g,
    RE_UNDER = /_/g,
    is_function = detect.isFunction,
    is_window = detect.isWindow,
    _array_map = Array.prototype.map,
    _array_push = Array.prototype.push,
    _array_slice = Array.prototype.slice,
    _elm_display = {},
    _html_containers = {};


function $(selector, context){
    if (selector) {
        if (selector.constructor === $) {
            return selector;
        } else if (typeof selector !== 'string') {
            var nodes = new $();
            if (detect.isArraylike(selector)
                    && selector.nodeType !== 1) {
                _array_push.apply(nodes, _array_slice.call(selector));
            } else {
                _array_push.call(nodes, selector);
            }
            return nodes;
        } else {
            selector = selector.trim();
            if (RE_HTMLTAG.test(selector)) {
                return $.createNodes(selector);
            } else if (context) {
                return $(context).find(selector);
            } else {
                return ext.find(selector);
            }
        }
    } else if (is_window(this)) {
        return new $();
    }
}

var ext = $.fn = $.prototype = [];

['map', 'filter', 'slice', 'reverse', 'sort'].forEach(function(method){
    var origin = this['_' + method] = this[method];
    this[method] = function(){
        return $(origin.apply(this, arguments));
    };
}, ext);

var origin_concat = ext._concat = ext.concat;
ext.concat = function(){
    return $(origin_concat.apply(this._slice(), check_array_argument(arguments)));
};

var origin_splice = ext._splice = ext.splice;
ext.splice = function(){
    return $(origin_splice.apply(this, check_array_argument(arguments)));
};

_.mix(ext, {

    constructor: $,

    toString: function(){
        return this.join(',');
    },

    // Traversing

    find: function(selector){
        var nodes = new $(), contexts;
        if (this === ext) {
            contexts = [doc];
        } else {
            nodes.prevObject = contexts = this;
        }
        if (RE_ID_SEL.test(selector)) {
            contexts = contexts[0];
            selector = selector.substr(1);
            var context_query = contexts !== doc 
                && contexts && contexts.getElementById;
            var elm = context_query 
                ? context_query.call(contexts, selector)
                : doc.getElementById(selector);
            if (elm) {
                nodes.push(elm);
            }
        } else {
            if (contexts[1]) {
                contexts.forEach(function(context){
                    _array_push.apply(this, 
                        $._querySelector(context, selector));
                }, nodes);
            } else if (contexts[0]) {
                _array_push.apply(nodes, 
                    $._querySelector(contexts[0], selector));
            }
        }
        return nodes;
    },

    eq: function(i){
        i = parseInt(i, 10);
        return i === -1 ? this.slice(-1) : this.slice(i, i + 1);
    },

    not: function(selector){
        return this.filter(function(node){
            return node && !this(node, selector);
        }, $.matches);
    },

    matches: function(selector){
        return this.filter(function(node){
            return node && this(node, selector);
        }, $.matches);
    },

    has: function(selector){
        return this.filter(function(node){
            if (!node) {
                return false;
            }
            if (typeof selector === 'string') {
                return $(selector, node).length;
            } else {
                return $.contains(node, $(selector)[0]);
            }
        });
    },

    parent: find_near('parentNode'),

    parents: function(selector){
        var ancestors = new $(), p = this,
            finding = selector 
                ? find_selector(selector, 'parentNode') 
                : function(node){
                    return this[this.push(node.parentNode) - 1];
                };
        while (p.length) {
            p = p.map(finding, ancestors);
        }
        return ancestors;
    },

    closest: function(selector){
        var ancestors = new $(), p = this, 
            finding = find_selector(selector, 'parentNode');
        while (p.length && !ancestors.length) {
            p = p.map(finding, ancestors);
        }
        return ancestors.length && ancestors || this;
    },

    siblings: find_sibs(NEXT_SIB, FIRST_CHILD),

    next: find_near(NEXT_SIB),

    nextAll: find_sibs(NEXT_SIB),

    nextUntil: find_sibs(NEXT_SIB, false, true),

    prev: find_near(PREV_SIB),

    prevAll: find_sibs(PREV_SIB),

    prevUntil: find_sibs(PREV_SIB, false, true),

    children: function(){
        var r = new $();
        this.forEach(function(node){
            _array_push.apply(this, _array_slice.call(node.children));
        }, r);
        return r;
    },

    contents: function(){
        var r = new $();
        this.forEach(function(node){
            _array_push.apply(this, _array_slice.call(node.childNodes));
        }, r);
        return r;
    },

    // Detection

    is: function(selector){
        return this.some(function(node){
            return node && $.matches(node, selector);
        });
    },

    hasClass: function(cname){
        for (var i = 0, l = this.length; i < l; i++) {
            if (this[i].classList.contains(cname)) {
                return true;
            }
        }
        return false;
    },

    // Properties

    addClass: function(cname){
        return nodes_access.call(this, cname, function(node, value){
            node.classList.add(value);
        }, function(node){
            return node.className;
        });
    },

    removeClass: function(cname){
        return nodes_access.call(this, cname, function(node, value){
            node.classList.remove(value);
        }, function(node){
            return node.className;
        });
    },

    toggleClass: function(cname, force){
        return nodes_access.call(this, cname, function(node, value){
            node.classList[force === undefined && 'toggle'
                || force && 'add' || 'remove'](value);
        }, function(node){
            return node.className;
        });
    },

    attr: kv_access(function(node, name, value){
        node.setAttribute(name, value);
    }, function(node, name){
        return node.getAttribute(name);
    }),

    removeAttr: function(name){
        this.forEach(function(node){
            node.removeAttribute(this);
        }, name);
        return this;
    },

    prop: kv_access(function(node, name, value){
        node[name] = value;
    }, function(node, name){
        return node[name];
    }),

    removeProp: function(name){
        this.forEach(function(node){
            delete node[this];
        }, name);
        return this;
    },

    data: kv_access(function(node, name, value){
        node.dataset[css_method(name)] = value;
    }, function(node, name){
        var data = node.dataset;
        if (!data) {
            return;
        }
        return name ? data[css_method(name)] 
            : _.mix({}, data);
    }),

    removeData: function(name){
        this.forEach(function(node){
            delete node.dataset[this];
        }, name);
        return this;
    },

    val: v_access(function(node, value){
        node.value = value;
    }, function(node){
        if (this.multiple) {
            return $('option', this).filter(function(item){
                return item.selected;
            }).map(function(item){
                return item.value;
            });
        }
        return node.value;
    }),

    empty: function(){
        this.forEach(function(node){
            node.innerHTML = '';
        });
        return this;
    },

    html: v_access(function(node, value){
        if (RE_HTMLTAG.test(value)) {
            $(node).empty().append(value);
        } else {
            node.innerHTML = value;
        }
    }, function(node){
        return node.innerHTML;
    }),

    text: v_access(function(node, value){
        node.textContent = value;
    }, function(node){
        return node.textContent;
    }),

    clone: function(){
        return this.map(function(node){
            return node.cloneNode(true);
        });
    },

    css: kv_access(function(node, name, value){
        var prop = css_prop(name);
        if (!value && value !== 0) {
            node.style.removeProperty(prop);
        } else {
            node.style.cssText += ';' + prop + ":" + css_unit(prop, value);
        }
    }, function(node, name){
        return node.style[css_method(name)] 
            || $.getPropertyValue(node, name);
    }, function(dict){
        var prop, value, css = '';
        for (var name in dict) {
            value = dict[name];
            prop = css_prop(name);
            if (!value && value !== 0) {
                this.forEach(function(node){
                    node.style.removeProperty(this);
                }, prop);
            } else {
                css += prop + ":" + css_unit(prop, value) + ';';
            }
        }
        this.forEach(function(node){
            node.style.cssText += ';' + this;
        }, css);
    }),

    hide: function(){
        return this.css("display", "none");
    },

    show: function(){
        this.forEach(function(node){
            if (node.style.display === "none") {
                node.style.display = null;
            }
            if (this(node, "display") === "none") {
                node.style.display = default_display(node.nodeName);
            }
        }, $.getPropertyValue);
        return this;
    },

    // Dimensions

    offset: function(){
        if (!this[0]) {
            return;
        }
        var set = this[0].getBoundingClientRect();
        return {
            left: set.left + window.pageXOffset,
            top: set.top + window.pageYOffset,
            width: set.width,
            height: set.height
        };
    },

    width: dimension('Width'),

    height: dimension('Height'),

    scrollLeft: scroll_offset(),

    scrollTop: scroll_offset(true),

    // Manipulation

    appendTo: operator_insert_to(1),

    append: operator_insert(1),

    prependTo: operator_insert_to(3),

    prepend: operator_insert(3),

    insertBefore: operator_insert_to(2),

    before: operator_insert(2),

    insertAfter: operator_insert_to(4),

    after: operator_insert(4),

    replaceAll: function(targets){
        var t = $(targets);
        this.insertBefore(t);
        t.remove();
        return this;
    },

    replaceWith: function(contents){
        return $(contents).replaceAll(this);
    },

    wrap: function(boxes){
        return nodes_access.call(this, boxes, function(node, value){
            $(value).insertBefore(node).append(node);
        });
    },

    wrapAll: function(boxes){
        $(boxes).insertBefore(this.eq(0)).append(this);
        return this;
    },

    wrapInner: function(boxes){
        return nodes_access.call(this, boxes, function(node, value){
            $(node).contents().wrapAll(value);
        });
    },

    unwrap: function(){
        this.parent().forEach(function(node){
            this(node).children().replaceAll(node);
        }, $);
        return this;
    },

    remove: function(){
        this.forEach(function(node){
            var parent = node.parentNode;
            if (parent) {
                parent.removeChild(node);
            }
        });
        return this;
    },

    // Event

    on: event_access('add'),

    off: event_access('remove'),

    once: function(subject, cb){
        var fn = function(){
            $(this).off(subject, fn);
            return cb.apply(this, arguments);
        };
        return $(this).on(subject, fn);
    },

    trigger: trigger,

    // Miscellaneous

    end: function(){
        return this.prevObject || new $();
    },

    each: function(fn){
        for (var i = 0, l = this.length; i < l; i++){
            var re = fn.call(this[i], i);
            if (re === false) {
                break;      
            }
        }
        return this;
    }

});

ext.bind = ext.on;
ext.unbind = ext.off;
ext.one = ext.once;

// private

function pick(v){ 
    return v; 
}

function find_selector(selector, attr){
    return function(node){
        if (attr) {
            node = node[attr];
        }
        if ($.matches(node, selector)) {
            this.push(node);
        }
        return node;
    };
}

function find_near(prop){
    return function(selector){
        return $(_.unique([undefined, doc, null].concat(
            this._map(selector ? function(node){
                var n = node[prop];
                if (n && $.matches(n, selector)) {
                    return n;
                }
            } : function(node){
                return node[prop];
            })
        )).slice(3));
    };
}

function find_sibs(prop, start, has_until){
    return function(target, selector){
        if (!has_until) {
            selector = target;
        }
        var sibs = new $();
        this.forEach(function(node){
            var until,
                n = start ? node.parentNode[start] : node;
            if (has_until) {
                until = $(target, node.parentNode);
            }
            do {
                if (until && until.indexOf(n) > -1) {
                    break;
                }
                if (node !== n && (!selector 
                    || $.matches(n, selector))) {
                    this.push(n);
                }
            } while (n = n[prop]);
        }, sibs);
        return _.unique(sibs);
    };
}

function nodes_access(value, setter, getter, name){
    if (value === null || value === undefined) {
        return this;
    }
    var is_fn_arg = is_function(value);
    this.forEach(function(node, i){
        if (!node) {
            return;
        }
        var v = !is_fn_arg 
            ? value 
            : value.call(this, i, 
                getter && getter.call(this, node, name));
        setter.call(this, node, name || v, v);
    }, this);
    return this;
}

function v_access(setter, getter){
    return function(value){
        if (arguments.length > 0) {
            return nodes_access.call(this, value, setter, getter);
        } else {
            return this[0] ? getter.call(this, this[0]) : undefined;
        }
        return this;
    };
}

function kv_access(setter, getter, map){
    return function(name, value){
        if (typeof name === 'object') {
            if (map) {
                map.call(this, name);
            } else {
                for (var k in name) {
                    this.forEach(function(node){
                        if (!node) {
                            return;
                        }
                        setter.call(this, node, k, name[k]);
                    }, this);
                }
            }
        } else {
            if (arguments.length > 1) {
                return nodes_access.call(this, value, setter, getter, name);
            } else {
                return this[0] ? getter.call(this, this[0], name) : undefined;
            }
        }
        return this;
    };
}

function event_access(action){
    function access(subject, cb){
        if (typeof subject === 'object') {
            for (var i in subject) {
                access.call(this, [i, subject[i]]);
            }
        } else if (cb) {
            subject = $.Event.aliases[subject] || subject;
            this.forEach(function(node){
                node[action + 'EventListener'](subject, this, false);
            }, cb);
        }  // not support 'removeAllEventListener'
        return this;
    }
    return access;
}

function trigger(me, event, data){
    if (this === $) {
        me = $(me);
    } else {
        data = event;
        event = me;
        me = this;
    }
    if (typeof event === 'string') {
        event = $.Event(event);
    }
    _.mix(event, data);
    me.forEach((SPECIAL_TRIGGERS[event.type]
            && !event.defaultPrevented) 
        ? function(node){
            node[event.type]();
        } : function(node){
            if ('dispatchEvent' in node) {
                node.dispatchEvent(this);
            }
        }, event);
    return this;
}

function css_method(name){
    return name.replace(RE_CSS_NAME, replace_css_method); 
}

function replace_css_method($0, $1){
    return $1 ? $1.toUpperCase() : '';
}

function css_prop(name) {
    return name.replace(RE_DOUBLE_COLON, '/')
        .replace(RE_CAMEL_BEGIN_WITH_CAP, '$1_$2')
        .replace(RE_CAMEL, '$1_$2')
        .replace(RE_UNDER, '-')
        .toLowerCase();
}

function css_unit(name, value) {
    return typeof value == "number" && !CSS_NUMBER[name] 
        && value + "px" || value;
}

function default_display(tag) {
    var display = _elm_display[tag];
    if (!display) {
        var tmp = document.createElement(tag);
        doc.body.appendChild(tmp);
        display = $.getPropertyValue(tmp, "display");
        tmp.parentNode.removeChild(tmp);
        if (display === "none") {
            display = "block";
        }
        _elm_display[tag] = display;
    }
    return display;
}

function dimension(method){
    return function(){
        var node = this[0];
        if (!node) {
            return;
        }
        return is_window(node)
            ? node['inner' + method]
            : node.nodeType === 9 
                ? node.documentElement['offset' + method] 
                : (this.offset() || {})[method.toLowerCase()];
    };
}

function scroll_offset(is_top){
    var method = 'scroll' + is_top ? 'Top' : 'Left',
        prop = 'page' + (is_top ? 'Y' : 'X') + 'Offset';
    return function(){
        var node = this[0];
        if (!node) {
            return;
        }
        return is_window(node) ? node[prop] : node[method];
    };
}

function insert_node(target, node, action){
    if (node.nodeName.toUpperCase() === 'SCRIPT' 
            && (!node.type || node.type === 'text/javascript')) {
        window['eval'].call(window, node.innerHTML);
    }
    switch(action) {
    case 1:
        target.appendChild(node);
        break;
    case 2: 
        target.parentNode.insertBefore(node, target);
        break;
    case 3:
        target.insertBefore(node, target.firstChild);
        break;
    case 4:
        target.parentNode.insertBefore(node, target.nextSibling);
        break;
    default:
        break;
    }
}

function insert_nodes(action, is_reverse){
    var fn = is_reverse ? function(target){
        insert_node(target, this, action);
    } : function(content){
        insert_node(this, content, action);
    };
    return function(selector){
        this.forEach(function(node){
            this.forEach(fn, node);
        }, is_reverse 
                || typeof selector !== 'string'
                || RE_HTMLTAG.test(selector)
            ? $(selector)
            : $.createNodes(selector));
        return this;
    };
}

function operator_insert_to(action){
    return insert_nodes(action, true);
}

function operator_insert(action){
    return insert_nodes(action);
}

function check_array_argument(args){
    return _array_map.call(args, function(i){
        if (typeof i === 'object') {
            return i._slice();
        } else {
            return i;
        }
    });
}

// public static API

$.find = $;

$._querySelector = function(context, selector){
    try {
        return _array_slice.call(context.querySelectorAll(selector));
    } catch (ex) {
        return [];
    }
};

$.matches = $.matchesSelector = function(elm, selector){
    return elm && elm.nodeType === 1 && elm[MATCHES_SELECTOR](selector);
};

$.contains = function(parent, elm){
    return parent !== elm && parent.contains(elm);
};

$.createNodes = function(str, attrs){
    var tag = (RE_HTMLTAG.exec(str) || [])[0] || str;
    var temp = _html_containers[tag];
    if (!temp) {
        temp = _html_containers[tag] = tag === 'tr' 
                && document.createElement('tbody')
            || (tag === 'tbody' || tag === 'thead' || tag === 'tfoot') 
                && document.createElement('table')
            || (tag === 'td' || tag === 'th') 
                && document.createElement('tr')
            || document.createElement('div');
    }
    temp.innerHTML = str;
    var nodes = new $();
    _array_push.apply(nodes, _array_slice.call(temp.childNodes));
    nodes.forEach(function(node){
        this.removeChild(node);
    }, temp);
    if (attrs) {
        for (var k in attrs) {
            nodes.attr(k, attrs[k]);
        }
    }
    return nodes;
};

$.getStyles = window.getComputedStyle && function(elm){
    return window.getComputedStyle(elm, null);
} || document.documentElement.currentStyle && function(elm){
    return elm.currentStyle;
};

$.getPropertyValue = function(elm, name){
    var styles = $.getStyles(elm);
    return styles.getPropertyValue 
        && styles.getPropertyValue(name) || styles[name];
};

$.Event = function(type, props) {
    var real_type = $.Event.aliases[type] || type;
    var bubbles = true,
        is_touch = TOUCH_EVENTS[type],
        event = document.createEvent(is_touch && 'TouchEvent' 
            || MOUSE_EVENTS[type] && 'MouseEvents' 
            || 'Events');
    if (props) {
        if ('bubbles' in props) {
            bubbles = !!props.bubbles;
            delete props.bubbles;
        }
        _.mix(event, props);
    }
    event[is_touch && 'initTouchEvent' 
        || 'initEvent'](real_type, bubbles, true);
    return event;
};

$.Event.aliases = {};

$.trigger = trigger;

$.camelize = css_method;
$.dasherize = css_prop;
$._vAccess = v_access;
$._kvAccess = kv_access;
$._nodesAccess = nodes_access;

return $;

});

/* @source dollar.js */;

/**
 * DollarJS
 * A jQuery-compatible and non-All-in-One library which is more "Zepto" than Zepto.js
 * Focus on DOM operations and mobile platform, wrap native API wherever possible.
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("dollar", [
  "dollar/origin"
], function($){
    return $;
});

/* @source mo/lang/oop.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/lang/oop", [
  "mo/lang/es5",
  "mo/lang/mix"
], function(es5, _, require, exports){

    var mix = _.mix;

    exports.construct = function(base, mixes, factory){
        if (mixes && !Array.isArray(mixes)) {
            factory = mixes;
            mixes = null;
        }
        if (!factory) {
            factory = function(){
                this.superConstructor.apply(this, arguments);
            };
        }
        if (!base.__constructor) {
            base.__constructor = base;
            base.__supr = base.prototype;
        }
        var proto = Object.create(base.prototype),
            supr = Object.create(base.prototype),
            current_supr = {};
        supr.__super = base.__supr;
        supr.__self = base.prototype;
        var sub = function(){
            this.superMethod = sub.__superMethod;
            this.superConstructor = su_construct;
            this.constructor = sub.__constructor;
            this.superClass = supr; // deprecated!
            return factory.apply(this, arguments);
        };
        sub.__supr = supr;
        sub.__constructor = sub;
        sub.__superMethod = function(name, args){
            var tm = {}, re = tm,
                last_supr = current_supr[name];
            if (!last_supr) {
                current_supr[name] = supr;
                if (!sub.prototype.hasOwnProperty(name)) {
                    re = this.superMethod.apply(this, arguments);
                }
            } else {
                current_supr[name] = last_supr.__super;
                if (!last_supr.__self.hasOwnProperty(name)) {
                    re = this.superMethod.apply(this, arguments);
                }
            }
            if (re === tm) {
                re = current_supr[name][name].apply(this, args);
            }
            current_supr[name] = last_supr;
            return re;
        };
        sub.prototype = proto;
        if (mixes) {
            mixes = mix.apply(this, mixes);
            mix(proto, mixes);
            mix(supr, mixes);
        }
        function su_construct(){
            var cache_constructor = base.__constructor,
                cache_super_method = base.__superMethod;
            base.__constructor = sub;
            base.__superMethod = sub.__superMethod;
            _apply.prototype = base.prototype;
            var su = new _apply(base, this, arguments);
            for (var i in su) {
                if (!this[i]) {
                    this[i] = supr[i] = su[i];
                }
            }
            base.__constructor = cache_constructor;
            base.__superMethod = cache_super_method;
            this.superConstructor = su_construct;
        }
        return sub;
    };

    function _apply(base, self, args){
        base.apply(self, args);
    }

});

/* @source mo/lang.js */;

/**
 * ES5/6 shim and minimum utilities for language enhancement
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/lang", [
  "mo/lang/es5",
  "mo/lang/type",
  "mo/lang/mix",
  "mo/lang/struct",
  "mo/lang/oop"
], function(es5, detect, _, struct, oo, require, exports){

    var host = this,
        window = host.window;

    _.mix(exports, detect, _, struct, oo);

    exports.ns = function(namespace, v, parent){
        var i, p = parent || window, n = namespace.split(".").reverse();
        while ((i = n.pop()) && n.length > 0) {
            if (typeof p[i] === 'undefined') {
                p[i] = {};
            } else if (typeof p[i] !== "object") {
                return false;
            }
            p = p[i];
        }
        if (typeof v !== 'undefined')
            p[i] = v;
        return p[i];
    };

});

/* @source moui/overlay.js */;

/**
 * Moui
 * OO-based UI behavior modules behind CardKit(mobile webapp framework)'s view components
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2013, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('moui/overlay', [
  "mo/lang",
  "dollar",
  "eventmaster",
  "mo/template/string"
], function(_, $, event, tpl) {

    var body = $('body'),

        NS = 'mouiOverlay',
        TPL_VIEW =
           '<div id="{{id}}" class="{{cname}}">\
                <header><h2></h2></header>\
                <article></article>\
            </div>',
        LOADING_DOTS = '<span class="loading"><i>.</i><i>.</i><i>.</i></span>',
        LOADING_DEFAULT = 'Loading...',

        _mid = 0,

        default_config = {
            title: '',
            content: '',
            className: 'moui-overlay',
            parent: body,
            openDelay: 50,
            closeDelay: 0,
            event: {}
        };

    function Overlay(opt) {
        this.init(opt);
        this.set(this._config);
    }

    Overlay.prototype = {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: default_config,

        init: function(opt){
            this.id = this._ns + (++_mid);
            this.event = event();
            this._config = _.config({}, opt, this._defaults);
            body.append(tpl.format(this._template, { 
                id: this.id,
                cname: this._config.className
            }));
            this._node = $('#' + this.id);
            this._header = this._node.find('header').eq(0);
            this._title = this._header.find('h1');
            this._content = this._node.find('article').eq(0);
            return this;
        },

        set: function(opt) {
            if (!opt) {
                return this;
            }
            _.config(this._config, opt, this._defaults);

            if (typeof opt.title === 'string') {
                this.setTitle(opt.title);
            }

            if (opt.content !== undefined) {
                this.setContent(opt.content);
            }

            if (opt.className !== undefined) {
                this._node[0].className = opt.className;
            }

            return this;
        },

        setTitle: function(text){
            this._title.html(text);
            return this;
        },

        setContent: function(html){
            this._content.html(html);
            return this;
        },

        insertNode: function(parent){
            this._node.appendTo(parent || this._config.parent);
        },

        showLoading: function(text) {
            this._node.addClass('loading');
            this._title.html((text || LOADING_DEFAULT) + LOADING_DOTS);
            return this;
        },

        hideLoading: function(){
            this._node.removeClass('loading');
            this._title.html(this._config.title);
            return this;
        },

        open: function(){
            clearTimeout(this._actimer);
            if (this.isOpened) {
                this.cancelClose();
                return this;
            }
            var self = this,
                args = arguments;
            this.prepareOpen.apply(self, args);
            this._actimer = setTimeout(function(){
                self.applyOpen.apply(self, args);
            }, this._config.openDelay);
            return this;
        },

        close: function(){
            clearTimeout(this._actimer);
            if (!this.isOpened) {
                this.cancelOpen();
                return this;
            }
            var self = this,
                args = arguments;
            this.prepareClose.apply(self, args);
            this._actimer = setTimeout(function(){
                self.applyClose.apply(self, args);
            }, this._config.closeDelay);
            return this;
        },

        prepareOpen: function(){
            this.insertNode();
            this._node.addClass('rendered');
            this.event.fire('prepareOpen', [this]);
        },

        prepareClose: function(){
            this.event.fire('prepareClose', [this]);
            this._node.removeClass('active');
        },

        cancelOpen: function(){
            this._node.removeClass('rendered');
            this.event.fire('cancelOpen', [this]);
        },

        cancelClose: function(){
            this._node.addClass('active');
            this.event.fire('cancelClose', [this]);
        },

        applyOpen: function() {
            this.isOpened = true;
            this._node.addClass('active');
            this.event.fire('open', [this]);
        },

        applyClose: function() {
            this.isOpened = false;
            this.hideLoading();
            this.beforeClose();
            this._node.removeClass('rendered');
            this.event.fire('close', [this]);
        },

        beforeClose: function(){},

        destroy: function() {
            this._node.remove();
            this.event.fire('destroy', [this]);
            return this;
        }

    };

    function exports(opt) {
        return new exports.Overlay(opt);
    }

    exports.Overlay = Overlay;

    return exports;

});

/* @source mo/template/micro.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/template/micro", [
  "mo/lang",
  "mo/template/string"
], function(_, stpl, require, exports){

    var document = this.document;

    exports.tplSettings = {
        _cache: {},
        comment: /\{\*([\s\S]+?)\*\}/g,
        evaluate: /\{%([\s\S]+?)%\}/g,
        interpolate: /\{%=([\s\S]+?)%\}/g
    };
    exports.tplHelpers = {
        mix: _.mix,
        escapeHTML: stpl.escapeHTML,
        substr: stpl.substr,
        include: convertTpl,
        _has: function(obj){
            return function(name){
                return _.ns(name, undefined, obj);
            };
        }
    };

    function convertTpl(str, data, namespace){
        var func, c  = exports.tplSettings, suffix = namespace ? '#' + namespace : '';
        if (!/[\t\r\n% ]/.test(str)) {
            func = c._cache[str + suffix];
            if (!func) {
                var tplbox = document.getElementById(str);
                if (tplbox) {
                    func = c._cache[str + suffix] = convertTpl(tplbox.innerHTML, false, namespace);
                }
            }
        } else {
            var tplfunc = new Function(namespace || 'obj', 'api', 'var __p=[];' 
                + (namespace ? '' : 'with(obj){')
                    + 'var mix=api.mix,escapeHTML=api.escapeHTML,substr=api.substr,include=api.include,has=api._has(' + (namespace || 'obj') + ');'
                    + '__p.push(\'' +
                    str.replace(/\\/g, '\\\\')
                        .replace(/'/g, "\\'")
                        .replace(c.comment, '')
                        .replace(c.interpolate, function(match, code) {
                            return "'," + code.replace(/\\'/g, "'") + ",'";
                        })
                        .replace(c.evaluate || null, function(match, code) {
                            return "');" + code.replace(/\\'/g, "'")
                                                .replace(/[\r\n\t]/g, ' ') + "__p.push('";
                        })
                        .replace(/\r/g, '\\r')
                        .replace(/\n/g, '\\n')
                        .replace(/\t/g, '\\t')
                    + "');" 
                + (namespace ? "" : "}")
                + "return __p.join('');");
            func = function(data, helpers){
                return tplfunc.call(this, data, _.mix({}, exports.tplHelpers, helpers));
            };
        }
        return !func ? '' : (data ? func(data) : func);
    }

    exports.convertTpl = convertTpl;
    exports.reloadTpl = function(str){
        delete exports.tplSettings._cache[str];
    };

});


/* @source mo/template.js */;

/**
 * A lightweight and enhanced micro-template implementation, and minimum utilities
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/template", [
  "mo/lang",
  "mo/template/string",
  "mo/template/micro"
], function(_, stpl, microtpl, require, exports){

    _.mix(exports, stpl, microtpl);

    exports.str2html = function(str){ // @TODO 
        var temp = document.createElement("div");
        temp.innerHTML = str;
        var child = temp.firstChild;
        if (temp.childNodes.length == 1) {
            return child;
        }
        var fragment = document.createDocumentFragment();
        do {
            fragment.appendChild(child);
        } while (child = temp.firstChild);
        return fragment;
    };

});

/* @source moui/growl.js */;

/**
 * Moui
 * OO-based UI behavior modules behind CardKit(mobile webapp framework)'s view components
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2013, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('moui/growl', [
  "dollar",
  "mo/lang",
  "mo/template",
  "moui/overlay"
], function($, _, tpl, overlay) {

    var NS = 'mouiGrowl',
        TPL_VIEW =
           '<div id="{{id}}" class="moui-growl">\
                <header><h2></h2></header>\
                <article></article>\
            </div>',
        CORNER = 'corner-',

        default_config = {
            className: 'moui-growl',
            closeDelay: 300,
            corner: 'center',
            expires: 1400,
            keepalive: false
        };

    var Growl = _.construct(overlay.Overlay);

    _.mix(Growl.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: _.mix({}, Growl.prototype._defaults, default_config),

        set: function(opt) {
            var self = this;
            self.superMethod('set', [opt]);

            if (opt.corner && opt.corner !== self._currentCorner) {
                if (self._currentCorner) {
                    self._node.removeClass(CORNER + self._currentCorner);
                }
                self._node.addClass(CORNER + opt.corner);
                self._currentCorner = opt.corner;
            }

            if (opt.expires !== undefined) {
                clearTimeout(self._exptimer);
                if (self.isOpened) {
                    set_expires(self);
                }
            }

            return self;
        },

        applyOpen: function(){
            clearTimeout(this._exptimer);
            if (this._config.expires != -1) {
                set_expires(this);
            }
            return this.superMethod('applyOpen', arguments);
        },

        applyClose: function(){
            this.isOpened = false;
            this._node.removeClass('rendered');
            this.event.fire('close', [this]);
            if (!this._config.keepalive) {
                this.destroy();
            }
        }

    });

    function set_expires(self){
        self._exptimer = setTimeout(function(){
            self.close();
        }, self._config.expires);
    }

    function exports(opt){
        return new exports.Growl(opt);
    }

    exports.Growl = Growl;

    return exports;

});

/* @source cardkit/ui/growl.js */;

define("cardkit/ui/growl", [
  "mo/lang",
  "dollar",
  "moui/growl"
], function(_, $, growl) {

var FLAG = '_ckGrowlUid',
    uid = 0,
    lib = {};

function exports(elm, opt){
    var id;
    var defaults = {
        corner: 'bottom'
    };
    if (elm.nodeName) {
        elm = $(elm);
        id = elm[0][FLAG];
        if (id && lib[id]) {
            lib[id].close();
        }
        id = elm[0][FLAG] = ++uid;
        opt = _.mix(defaults, elm.data(), opt);
    } else {
        opt = _.mix(defaults, elm);
    }
    opt.className = 'ck-growl';
    _.merge(opt, exports.defaultOptions);
    var g = growl(opt);
    if (id) {
        lib[id] = g;
    }
    return g;
}

exports.defaultOptions = {};

return exports;

});

/* @source mo/network/ajax.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/network/ajax", [], function(require, exports){

    var rquery = /\?/,
        rhash = /#.*$/,
        rnoContent = /^(?:GET|HEAD)$/,
        xhrObj = window.XMLHttpRequest 
                && (window.location.protocol !== "file:" 
                    || !window.ActiveXObject) 
            ? function(){
                return new window.XMLHttpRequest();
            } : function(){
                try {
                    return new window.ActiveXObject("Microsoft.XMLHTTP");
                } catch(e) {}
            };

    exports.params = function(a) {
        var s = [];
        if (a.constructor == Array) {
            for (var i = 0; i < a.length; i++)
                s.push(a[i].name + "=" + encodeURIComponent(a[i].value));
        } else {
            for (var j in a)
                s.push(j + "=" + encodeURIComponent(a[j]));
        }
        return s.join("&").replace(/%20/g, "+");
    };

    exports.parseJSON = function(json){
        json = json.replace(/^.*?(\{|\[)/, '$1')
            .replace(/(\]|\})[^\]\}]*$/, '$1');
        try {
            if (window.JSON && window.JSON.parse) {
                json = window.JSON.parse(json);
            } else {
                json = (new Function("return " + json))();
            }
        } catch(ex) {
            json = false;
        }
        return json;
    };

    /**
     * From jquery by John Resig
     */ 
    exports.ajax = function(s){
        var options = {
            type: s.type || "GET",
            url: s.url || "",
            data: s.data || null,
            dataType: s.dataType,
            contentType: s.contentType === false 
                ? false 
                : (s.contentType || "application/x-www-form-urlencoded"),
            username: s.username || null,
            password: s.password || null,
            timeout: s.timeout || 0,
            processData: s.processData === undefined ? true : s.processData,
            beforeSend: s.beforeSend || null,
            complete: s.complete || function(){},
            handleError: s.handleError || function(){},
            success: s.success || function(){},
            xhrFields: s.xhrFields || null,
            headers: s.headers || {},
            accepts: {
                xml: "application/xml, text/xml",
                html: "text/html",
                script: "text/javascript, application/javascript",
                json: "application/json, text/javascript",
                text: "text/plain",
                _default: "*/*"
            }
        };
        var type = options.type.toUpperCase();
        var noContent = rnoContent.test(type);

        options.url = options.url.replace(rhash, "");
        
        if (options.data && options.processData 
                && typeof options.data !== "string") {
            options.data = this.params(options.data);
        }
        if (options.data && noContent) {
            options.url += (rquery.test(options.url) ? "&" : "?") 
                + options.data;
            options.data = null;
        }
        
        var status, data, requestDone = false, xhr = xhrObj();
        if (!xhr) {
            return;
        }
        if (options.username) {
            xhr.open(type, options.url, true, 
                options.username, options.password);
        } else {
            xhr.open(type, options.url, true);
        }

        try {
            var i;
            if (options.xhrFields) {
                for (i in options.xhrFields) {
                    xhr[i] = options.xhrFields[i];
                }
            }
            if (options.data && !noContent 
                    && options.contentType !== false) { 
                xhr.setRequestHeader("Content-Type", options.contentType);
            }
            xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            xhr.setRequestHeader("Accept", 
                options.dataType && options.accepts[options.dataType] ?
                    options.accepts[options.dataType] + ", */*; q=0.01" :
                    options.accepts._default);
            for (i in options.headers) {
                xhr.setRequestHeader(i, options.headers[i]);
            }
        } catch(e){}
        
        if (options.beforeSend) {
            options.beforeSend(xhr);
        }
            
        var onreadystatechange = xhr.onreadystatechange = function(isTimeout){
            if (!xhr || xhr.readyState === 0 || isTimeout === "abort") {
                if (!requestDone) {
                    options.complete(xhr);
                }
                requestDone = true;
                if (xhr) {
                    xhr.onreadystatechange = noop;
                }
            } else if (!requestDone && xhr 
                    && (xhr.readyState === 4 || isTimeout === "timeout")) {
                requestDone = true;
                xhr.onreadystatechange = noop;
                status = isTimeout === "timeout" ?
                    "timeout" :
                    !httpSuccess(xhr) ?
                        "error" : "success";
                var errMsg;
                if (status === "success") {
                    try {
                        data = httpData(xhr, options.dataType);
                    } catch(parserError) {
                        status = "parsererror";
                        errMsg = parserError;
                    }
                    options.success(data);
                } else {
                    options.handleError(xhr, status, errMsg);
                }
                options.complete(xhr);
                if (isTimeout === "timeout") {
                    xhr.abort();
                }
                xhr = null;
            }
        };

        try {
            var oldAbort = xhr.abort;
            xhr.abort = function(){
                if (xhr) {
                    Function.prototype.call.call(oldAbort, xhr);
                }
                onreadystatechange('abort');
            };
        } catch(e) {}

        if (options.timeout > 0) {
            setTimeout(function(){
                if (xhr && !requestDone) {
                    onreadystatechange("timeout");
                }
            }, options.timeout);
        }

        try {
            xhr.send(noContent || options.data == null ? null : options.data);
        } catch(sendError) {
            options.handleError(xhr, null, sendError);
            options.complete(xhr);
        }

        function httpSuccess(r) {
            try {
                return !r.status && location.protocol == "file:" 
                    || ( r.status >= 200 && r.status < 300 ) 
                    || r.status === 304 || r.status === 1223 || r.status === 0;
            } catch(e){}
            return false;
        }

        function httpData(r, type) {
            var ct = r.getResponseHeader("content-type") || '';
            var xml = type === "xml" || !type && ct && ct.indexOf("xml") >= 0;
            var data = xml ? r.responseXML : r.responseText;
            if (xml && data.documentElement.tagName === "parsererror") {
                throw "parsererror";
            }
            if (type === "json" || !type && ct.indexOf("json") >= 0) {
                data = exports.parseJSON(data);
            } else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
                globalEval(data);
            }
            return data;
        }

        return xhr;
    };

    function noop(){}

    function globalEval(code){
        var script, indirect = eval;
        if (code) {
            if (/^[^\S]*use strict/.test(code)) {
                script = document.createElement("script");
                script.text = code;
                document.head.appendChild(script)
                    .parentNode.removeChild(script);
            } else {
                indirect(code);
            }
        }
    }

});

/* @source mo/network.js */;

/**
 * Standalone jQuery.ajax API and enhanced getJSON, and so on
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/network", [
  "mo/lang",
  "mo/network/ajax"
], function(_, exports){

    var window = this,
        uuid4jsonp = 1;

    exports.getScript = function(url, op){
        var doc = _.isWindow(this) ? this.document : document,
            s = doc.createElement("script");
        s.type = "text/javascript";
        s.async = "async"; //for firefox3.6
        if (!op)
            op = {};
        else if (_.isFunction(op))
            op = { callback: op };
        if (op.charset)
            s.charset = op.charset;
        s.src = url;
        var h = doc.getElementsByTagName("head")[0];
        s.onload = s.onreadystatechange = function(__, isAbort){
            if ( isAbort || !s.readyState || /loaded|complete/.test(s.readyState) ) {
                s.onload = s.onreadystatechange = null;
                if (h && s.parentNode) {
                    h.removeChild(s);
                }
                s = undefined;
                if (!isAbort && op.callback) {
                    op.callback();
                }
            }
        };
        h.insertBefore(s, h.firstChild);
    };

    exports.getStyle = function(url){
        var doc = this.document || document,
            s = doc.createElement("link");
        s.setAttribute('type', 'text/css');
        s.setAttribute('rel', 'stylesheet');
        s.setAttribute('href', url);
        var h = doc.getElementsByTagName("head")[0];
        h.appendChild(s);
    };

    var RE_DOMAIN = /https?\:\/\/(.+?)\//;
    exports.getJSON = function(url, data, fn, op){
        var domain = url.match(RE_DOMAIN);
        if (!data || _.isFunction(data)) {
            op = fn;
            fn = data;
            data = {};
        }
        if (fn) {
            if ((!op || !op.isScript) && (!domain || domain[1] === window.location.host)) {
                exports.ajax({
                    url: url,
                    data: data,
                    success: fn,
                    error: op && op.error,
                    dataType: "json"
                });
                return true;
            }
        }
        op = _.mix({
            charset: "utf-8",
            callback: "__oz_jsonp" + (++uuid4jsonp)
        }, op || {});
        if (op.random) {
            data[op.random] = +new Date();
        }
        var cbName = op.callbackName || 'jsoncallback';
        data[cbName] = op.callback;
        url = [url, /\?/.test(url) ? "&" : "?", exports.params(data)].join("");
        if (fn) {
            _.ns(op.callback, fn);
        }
        delete op.callback;
        exports.getScript(url, op);
    };

    exports.getRequest = function(url, params){
        var img = new Image();
        img.onload = function(){ img = null; }; //阻止IE下的自动垃圾回收引起的请求未发出状况
        img.src = !params ? url : [url, /\?/.test(url) ? "&" : "?", typeof params == "string" ? params : exports.params(params)].join('');
    };

    exports.httpParam = exports.params; // deprecated

    return exports;

});

/* @source cardkit/ui/util.js */;

define("cardkit/ui/util", [
  "mo/lang",
  "dollar",
  "mo/network"
], function(_, $, net){

var _default_steps = {
    flag: '_ckViewUid',
    forceOptions: {},
    defaultOptions: {},
    customOptions: {},
    config: function(){},
    extend: function(){}
};

var exports = {

    singleton: function(steps){
        var uid = 0, 
            lib = {};
        steps = _.merge(steps, _default_steps);
        function factory(elm, opt){
            var id = elm;
            if (typeof elm === 'object') {
                elm = $(elm);
                id = elm[0][steps.flag];
            } else {
                elm = false;
            }
            var re = id && lib[id];
            if (re) {
                if (opt) {
                    steps.config(re, opt);
                }
            } else {
                if (elm) {
                    id = elm[0][steps.flag] = ++uid;
                }
                opt = _.merge(_.mix(opt || {}, 
                        factory.forceOptions, steps.forceOptions), 
                    steps.defaultOptions, factory.defaultOptions);
                re = lib[id] = steps.factory(elm, opt);
                _.merge(re._config, 
                    _.merge(_.interset(opt, steps.customOptions), 
                        steps.customOptions));
                steps.extend(re, elm);
            }
            return re;
        }
        factory.forceOptions = {};
        factory.defaultOptions = {};
        factory.gc = function(check){
            for (var i in lib) {
                if (check(lib[i])) {
                    delete lib[i];
                }
            }
        };
        return factory;
    },

    request: function(opt){
        var cfg = opt.config,
            url = cfg.jsonUrl || cfg.url;
        if (url) {
            var data;
            url = url.replace(/\?(.+)$/, function($0, $1) {
                data = $1.replace(/#.*/, '');
                return '';
            });
            net.ajax({
                url: url,
                data: data,
                type: cfg.method || 'post',
                dataType: cfg.jsonUrl ? 'json' : 'text',
                beforeSend: opt.before,
                handleError: opt.callback,
                success: opt.callback
            });
        } else {
            opt.callback();
        }
    }

};

return exports;

});

/* @source moui/control.js */;

/**
 * Moui
 * OO-based UI behavior modules behind CardKit(mobile webapp framework)'s view components
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2013, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('moui/control', [
  "mo/lang",
  "dollar",
  "eventmaster"
], function(_, $, event){

    var default_config = {
        field: null,
        label: null,
        numField: null,
        numStep: 1,
        enableVal: 1,
        disableVal: 0,
        enableLabel: '',
        disableLabel: '',
        loadingLabel: 'Loading...'
    };

    function Control(elm, opt){
        this.init(elm, opt);
        this.set(this._config);
    }

    Control.prototype = {

        _defaults: default_config,

        init: function(elm, opt){
            this.event = event();
            var node = this._node = $(elm);
            if (node.hasClass('enabled')) {
                this.isEnabled = true;
            }
            this._numField = [];
            opt = _.mix({
                field: node,
                label: node
            }, this.data(), opt);
            this.setNodes(opt);
            if (this._label[0]) {
                this._isLabelClose = is_empty(this._label[0]);
            }
            if (this._numField[0]) {
                this._isNumFieldClose = is_empty(this._numField[0]);
            }
            if (opt.enableVal === undefined) {
                opt.enableVal = this.val();
            }
            if (opt.enableLabel === undefined) {
                opt.enableLabel = this.label();
            }
            if (opt.disableVal === undefined) {
                opt.disableVal = this.val();
            }
            if (opt.disableLabel === undefined) {
                opt.disableLabel = this.label();
            }
            this._disableAttrs = {};
            this._enableAttrs = {};
            _.each(opt, function(value, name){
                var k;
                if (k = /^enableAttr([A-Z]\w*)/.exec(name)) {
                    k = k[1].toLowerCase();
                    this._disableAttrs[k] = node.attr(k);
                    if (!this._enableAttrs[k]) {
                        this._enableAttrs[k] = value;
                    }
                } else if (k = /^disableAttr([A-Z]\w*)/.exec(name)) {
                    k = k[1].toLowerCase();
                    this._enableAttrs[k] = node.attr(k);
                    if (!this._disableAttrs[k]) {
                        this._disableAttrs[k] = value;
                    }
                }
            }, this);
            this._config = _.config({}, opt, this._defaults);
        },

        set: function(opt){
            if (!opt) {
                return this;
            }
            _.mix(this._config, opt);
            this.setNodes(opt);
            return this;
        },

        setNodes: function(opt){
            if (opt.field !== undefined) {
                if (opt.field) {
                    this._field = $(opt.field, 
                        typeof opt.field === 'string' && this._node).eq(0);
                } else {
                    this._field = [];
                }
            }
            if (opt.label !== undefined) {
                if (opt.label) {
                    this._label = $(opt.label, 
                        typeof opt.label === 'string' && this._node).eq(0);
                } else {
                    this._label = [];
                }
            }
            if (opt.numField !== undefined) {
                if (opt.numField) {
                    this._numField = $(opt.numField, 
                        typeof opt.numField === 'string' && this._node).eq(0);
                } else {
                    this._numField = [];
                }
            }
            return this;
        },

        val: function(){
            var field = this._field;
            if (!field[0]) {
                return;
            }
            var re, args = [].slice.call(arguments);
            if (field[0].nodeName === 'A') {
                args.unshift('href');
                re = field.attr.apply(field, args);
                return re === field ? field[0].href : re;
            } else {
                re = field.val.apply(field, args);
                return re === field ? field.val() : re;
            }
        },

        label: function(){
            var label = this._label;
            if (!label[0]) {
                return;
            }
            var args = [].slice.call(arguments),
                method = this._isLabelClose ? 'val' : 'html',
                re = label[method].apply(label, args);
            return re === label ? label[method]() : re;
        },

        num: function(n) {
            var numfield = this._numField;
            if (!numfield[0]) {
                return;
            }
            var args = [],
                method = this._isNumFieldClose ? 'val' : 'html';
            if (n != null) {
                args.push(parseFloat(numfield[method]()) + n);
            }
            var re = numfield[method].apply(numfield, args);
            return re === numfield ? numfield[method]() : re;
        },

        data: function(){
            return this._node.data();
        },

        showLoading: function(){
            this._node.addClass('loading');
            this.label(this._config.loadingLabel);
            return this;
        },

        hideLoading: function(){
            this._node.removeClass('loading');
            return this;
        },

        toggle: function(){
            if (this.isEnabled) {
                this.disable();
            } else {
                this.enable();
            }
            return this;
        },

        enable: function(){
            if (this.isEnabled) {
                return this;
            }
            this.isEnabled = true;
            this._node.addClass('enabled');
            this.val(this._config.enableVal);
            this.num(this._config.numStep);
            if (this._config.enableLabel) {
                this.label(this._config.enableLabel);
            }
            _.each(this._enableAttrs, function(value, name){
                this._node.attr(name, value);
            }, this);
            this.event.reset('disable')
                .resolve('enable', [this]);
            return this;
        },

        disable: function(){
            if (!this.isEnabled) {
                return this;
            }
            this.isEnabled = false;
            this._node.removeClass('enabled');
            this.val(this._config.disableVal);
            this.num(0 - this._config.numStep);
            if (this._config.disableLabel) {
                this.label(this._config.disableLabel);
            }
            _.each(this._disableAttrs, function(value, name){
                this._node.attr(name, value);
            }, this);
            this.event.reset('enable')
                .resolve('disable', [this]);
            return this;
        }
    
    };

    function is_empty(elm){
        if (!elm.innerHTML) {
            elm.innerHTML = ' ';
            if (!elm.innerHTML) {
                return true;
            }
            elm.innerHTML = '';
        }
        return false;
    }

    function exports(elm, opt){
        return new exports.Control(elm, opt);
    }

    exports.Control = Control;

    return exports;

});


/* @source moui/picker.js */;

/**
 * Moui
 * OO-based UI behavior modules behind CardKit(mobile webapp framework)'s view components
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2013, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('moui/picker', [
  "mo/lang",
  "dollar",
  "eventmaster",
  "moui/control"
], function(_, $, event, control){

    var OID = '_moPickerOid',

        default_config = {
            field: 'input[type="hidden"]',
            options: '.option',
            ignoreRepeat: false,
            ignoreStatus: false,
            multiselect: false
        };

    function Picker(elm, opt){
        this.init(elm, opt);
        this.set(this._config);
    }

    Picker.prototype = {

        _defaults: default_config,

        init: function(elm, opt){
            this._uoid = 0;
            this.event = event();
            this._node = $(elm);
            this._options = [];
            opt = _.mix({}, this.data(), opt);
            this._config = _.config({}, opt, this._defaults);
            return this;
        },

        set: function(opt){
            if (!opt) {
                return this;
            }
            _.mix(this._config, opt);

            if (opt.multiselect !== undefined) {
                if (!opt.multiselect) {
                    this._allSelected = null;
                    this._lastSelected = null;
                } else if (!this._allSelected) {
                    this._allSelected = [];
                }
            }

            if (opt.field !== undefined) {
                if (opt.field) {
                    this._field = $(opt.field, 
                        typeof opt.field === 'string' && this._node).eq(0);
                } else {
                    this._field = [];
                }
            }

            if (opt.options) {
                this._options.forEach(this.removeOption, this);
                $(opt.options, this._node).forEach(this.addOption, this);
            }

            return this;
        },

        _watchEnable: function(controller){
            controller._pickerEnableWatcher = when_enable.bind(this);
            controller.event.bind('enable', controller._pickerEnableWatcher);
        },

        _watchDisable: function(controller){
            controller._pickerDisableWatcher = when_disable.bind(this);
            controller.event.bind('disable', controller._pickerDisableWatcher);
        },

        _unwatchEnable: function(controller){
            controller.event.unbind('enable', controller._pickerEnableWatcher);
        },

        _unwatchDisable: function(controller){
            controller.event.unbind('disable', controller._pickerDisableWatcher);
        },

        addOption: function(elm){
            elm = $(elm)[0];
            if (elm[OID] || elm.nodeType !== 1) {
                return this;
            }
            elm[OID] = ++this._uoid;
            var controller = control(elm, {
                enableVal: elm.value,
                label: false
            });
            this._watchEnable(controller);
            this._options.push(controller);
            if (controller.isEnabled) {
                change.call(this, 'enable', controller);
            }
            return this;
        },

        removeOption: function(elm){
            var controller;
            if (elm.constructor === control.Control) {
                controller = elm;
                elm = elm._node[0];
            } else {
                controller = this.getOption(elm);
            }
            this.unselect(elm);
            if (controller) {
                this._options.splice(
                    this._options.indexOf(controller), 1);
            }
            return this;
        },

        getOption: function(elm){
            if (typeof elm === 'number') {
                elm = this._options[elm];
            } else if (typeof elm === 'string') {
                elm = this._options.filter(function(controller){
                    return controller.val() === elm;
                })[0];
            } else {
                var oid = $(elm)[0][OID];
                if (!oid) {
                    return null;
                }
                elm = this._options.filter(function(controller){
                    return controller._node[0][OID] === oid;
                })[0];
            }
            return elm;
        },

        getOptions: function() {
            return this._options;
        },

        getSelected: function() {
            if (this._config.multiselect) {
                return this._allSelected || [];
            } else {
                return this._lastSelected
                    ? [this._lastSelected] : [];
            }
        },

        getSelectedData: function() {
            var list = this.getSelected().map(function(controller){
                return controller.data();
            });
            if (this._config.multiselect) {
                return list;
            } else {
                return list[0];
            }
        },

        val: function(){
            var list = this.getSelected().map(function(controller){
                return controller.val();
            });
            if (this._config.multiselect) {
                return list;
            } else {
                return list[0];
            }
        },

        data: function(){
            return this._node.data();
        },

        showLoading: function(){
            this._node.addClass('loading');
            return this;
        },

        hideLoading: function(){
            this._node.removeClass('loading');
            return this;
        },

        undo: function(){
            if (this._lastActionTarget) {
                this._lastActionTarget.toggle();
            }
            return this;
        },

        selectAll: function(){
            if (this._config.multiselect) {
                this._options.forEach(function(controller){
                    if (!controller.isEnabled) {
                        this._unwatchEnable(controller);
                        controller.enable();
                        change.call(this, 'enable', controller);
                    }
                }, this);
                this.event.fire('change', [this, this._options[0]]);
            }
            this._lastActionTarget = null;
            return this;
        },

        unselectAll: function(){
            if (this._config.multiselect) {
                this._options.forEach(function(controller){
                    if (controller.isEnabled) {
                        this._unwatchDisable(controller);
                        controller.disable();
                        change.call(this, 'disable', controller);
                    }
                }, this);
                this._lastActionTarget = null;
                this.event.fire('change', [this, this._options[0]]);
            } else {
                this.undo();
            }
            return this;
        },

        selectInvert: function(){
            if (this._config.multiselect) {
                this._options.forEach(function(controller){
                    if (controller.isEnabled) {
                        this._unwatchDisable(controller);
                        controller.toggle();
                        change.call(this, 'disable', controller);
                    } else {
                        this._unwatchEnable(controller);
                        controller.toggle();
                        change.call(this, 'enable', controller);
                    }
                }, this);
                this.event.fire('change', [this, this._options[0]]);
            }
            this._lastActionTarget = null;
            return this;
        },

        select: function(i){
            var controller = this.getOption(i);
            if (controller) {
                if (!this._config.multiselect && this._config.ignoreStatus) {
                    change.call(this, 'enable', controller);
                    this.event.fire('change', [this, controller]);
                } else {
                    if (this._config.multiselect 
                            && this._allSelected.indexOf(controller) !== -1
                            || !this._config.multiselect
                            && this._lastSelected === controller) {
                        if (!this._config.ignoreRepeat) {
                            return this.unselect(i);
                        }
                    }
                    this._lastActionTarget = controller.enable();
                }
            }
            return this;
        },

        unselect: function(i){
            if (!i) {
                this.unselectAll();
            } else {
                var controller = this.getOption(i);
                if (controller) {
                    this._lastActionTarget = controller.disable();
                }
            }
            return this;
        }

    };

    function when_enable(controller){
        change.call(this, 'enable', controller);
        this.event.fire('change', [this, controller]);
    }

    function when_disable(controller){
        change.call(this, 'disable', controller);
        this.event.fire('change', [this, controller]);
    }

    function change(subject, controller){
        if (subject === 'enable') {
            if (!this._config.ignoreStatus) {
                this._unwatchEnable(controller);
                this._watchDisable(controller);
            }
            if (this._config.multiselect) {
                this._allSelected.push(controller);
            } else {
                var last = this._lastSelected;
                this._lastSelected = controller;
                if (last) {
                    this._unwatchDisable(last);
                    last.disable();
                    this._watchEnable(last);
                }
            }
        } else {
            if (!this._config.ignoreStatus) {
                this._unwatchDisable(controller);
                this._watchEnable(controller);
            }
            if (this._config.multiselect) {
                var i = this._allSelected.indexOf(controller);
                if (i !== -1) {
                    this._allSelected.splice(i, 1);
                }
            } else {
                if (controller 
                        && this._lastSelected !== controller) {
                    return;
                }
                this._lastSelected = null;
            }
        }
        if (this._field[0]) {
            this._field.val(this.val());
        }
    }

    function exports(elm, opt){
        return new exports.Picker(elm, opt);
    }

    exports.Picker = Picker;

    return exports;

});


/* @source moui/actionview.js */;

/**
 * Moui
 * OO-based UI behavior modules behind CardKit(mobile webapp framework)'s view components
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2013, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('moui/actionview', [
  "dollar",
  "mo/lang",
  "mo/template/string",
  "moui/overlay",
  "moui/picker"
], function($, _, tpl, overlay, picker) {

    var mix = _.mix,

        NS = 'mouiActionView',
        TPL_VIEW = 
            '<div id="{{id}}" class="{{cname}}">\
                <div class="shd"></div>\
                <div class="wrapper">\
                    <div class="content">\
                        <header><h1></h1></header>\
                        <div class="desc"></div>\
                        <article></article>\
                    </div>\
                </div>\
                <footer>\
                    <span class="cancel"></span>\
                    <span class="confirm" data-is-default="true"></span>\
                </footer>\
            </div>',

        default_config = {
            className: 'moui-actionview',
            closeDelay: 500,
            confirmText: 'OK',
            cancelText: 'Cancel',
            options: null,
            multiselect: false
        };

    var ActionView = _.construct(overlay.Overlay);

    mix(ActionView.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: _.mix({}, ActionView.prototype._defaults, default_config),

        init: function(opt) {
            this.superMethod('init', [opt]);
            this._wrapper = this._node.find('.wrapper').eq(0);
            this._actionsWrapper = this._content;
            this._content = this._wrapper.find('.desc').eq(0);
            this._footer = this._node.find('footer').eq(-1);
            this._confirmBtn = this._footer.find('.confirm');
            this._cancelBtn = this._footer.find('.cancel');
            return this;
        },

        set: function(opt) {
            if (!opt) {
                return this;
            }
            this.superMethod('set', [opt]);

            if (opt.options !== undefined) {
                this._actionsWrapper.empty();
                var options = opt.options 
                    ? $(opt.options).clone()
                    : [];
                if (options.length) {
                    this._actionsWrapper.append(options);
                    this._picker = picker(this._actionsWrapper, {
                        options: options,
                        multiselect: this._config.multiselect,
                        ignoreStatus: !this._config.multiselect
                    });
                    this._node.removeClass('confirm-kind');
                } else {
                    this._node.addClass('confirm-kind');
                }
            }

            if (opt.multiselect !== undefined) {
                if (opt.multiselect) {
                    this._footer.addClass('multi');
                } else {
                    this._footer.removeClass('multi');
                }
            }

            if (opt.confirmText) {
                this._confirmBtn.html(opt.confirmText);
            }

            if (opt.cancelText) {
                this._cancelBtn.html(opt.cancelText);
            }

            return this;
        },

        val: function(){
            if (this._picker) {
                return this._picker.val();
            }
        },

        data: function(){
            if (this._picker) {
                return this._picker.getSelectedData();
            }
        },

        confirm: function(){
            this.event.fire('confirm', [this, this._picker]);
            return this.ok();
        },

        cancel: function(){
            this.event.fire('cancel', [this, this.picker]);
            return this.ok();
        },

        ok: function(){
            this.close();
            return this.event.promise('close');
        },

        applyOpen: function(){
            if (!this._config.multiselect && this._picker) {
                var self = this;
                this._picker.event.once('change', function(){
                    self.confirm();
                });
            }
            return this.superMethod('applyOpen', arguments);
        },

        applyClose: function(){
            if (!this._config.multiselect && this._picker) {
                this._picker.event.reset();
            }
            return this.superMethod('applyClose', arguments);
        }

    });

    ActionView.prototype.done = ActionView.prototype.ok;

    ['select', 'unselect', 'undo',
        'selectAll', 'unselectAll', 'selectInvert'].forEach(function(method){
        this[method] = function(){
            return this._picker[method].apply(this._picker, arguments);
        };
    }, ActionView.prototype);

    function exports(opt) {
        return new exports.ActionView(opt);
    }

    exports.ActionView = ActionView;

    return exports;

});

/* @source cardkit/ui/actionview.js */;

define("cardkit/ui/actionview", [
  "moui/actionview",
  "cardkit/bus",
  "cardkit/ui/util"
], function(actionView, bus, util) {

var exports = util.singleton({

    flag: '_ckActionViewUid',

    forceOptions: {
        className: 'ck-actionview'
    },

    factory: function(elm, opt){
        return actionView(opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        var eprops = {
            component: o
        };
        o.event.bind('prepareOpen', function(o){
            exports.current = o;
        }).bind('cancelOpen', function(){
            exports.current = null;
        }).bind('open', function(o){
            bus.fire('actionView:open', [o]);
            if (source) {
                source.trigger('actionView:open', eprops);
            }
        }).bind('close', function(){
            exports.current = null;
            bus.unbind('actionView:confirmOnThis');
            bus.fire('actionView:close', [o]);
            if (source) {
                source.trigger('actionView:close', eprops);
            }
        }).bind('cancel', function(){
            bus.fire('actionView:cancel', [o]);
            if (source) {
                source.trigger('actionView:cancel', eprops);
            }
        }).bind('confirm', function(o, picker){
            bus.fire('actionView:confirmOnThis', [o])
                .fire('actionView:confirm', [o]);
            if (source) {
                source.trigger('actionView:confirm', eprops);
            }
            if (picker && picker._lastSelected) {
                var elm = picker._lastSelected._node[0];
                if (elm.nodeName === 'A') {
                    bus.fire('actionView:jump', [o, elm.href, elm.target]);
                }
            }
        });
    }

});

return exports;

});

/* @source moui/modalview.js */;

/**
 * Moui
 * OO-based UI behavior modules behind CardKit(mobile webapp framework)'s view components
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2013, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('moui/modalview', [
  "dollar",
  "mo/lang",
  "mo/template/string",
  "moui/overlay"
], function($, _, tpl, overlay) {

    var mix = _.mix,

        NS = 'mouiModalView',
        TPL_VIEW =
           '<div id="{{id}}" class="{{cname}}">\
                <div class="shd"></div>\
                <div class="wrapper">\
                    <header>\
                        <button type="button" class="confirm" \
                            data-fluid="true" data-is-default="true"></button>\
                        <button type="button" class="cancel" \
                            data-fluid="true"></button>\
                        <h1></h1>\
                    </header>\
                    <article><div class="content"></div></article>\
                </div>\
            </div>',

        default_config = {
            className: 'moui-modalview',
            iframe: false,
            hideConfirm: false,
            confirmText: 'OK',
            cancelText: 'Cancel'
        };


    var ModalView = _.construct(overlay.Overlay);

    mix(ModalView.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: _.mix({}, ModalView.prototype._defaults, default_config),

        init: function(opt) {
            this.superMethod('init', [opt]);
            this._wrapper = this._node.find('.wrapper').eq(0);
            this._contentWrapper = this._wrapper.find('article').eq(0);
            this._content = this._contentWrapper.find('.content').eq(0);
            this._confirmBtn = this._header.find('.confirm');
            this._cancelBtn = this._header.find('.cancel');
            return this;
        },

        set: function(opt) {
            if (!opt) {
                return this;
            }
            var self = this;
            self.superMethod('set', [opt]);

            if (opt.content !== undefined) {
                self._config.iframe = null;
            } else if (opt.iframe) {
                self._setIframeContent(opt);
            } 
            
            if (opt.hideConfirm !== undefined) {
                if (opt.hideConfirm) {
                    this._confirmBtn.hide();
                } else {
                    this._confirmBtn.show();
                }
            }

            if (opt.confirmText) {
                this._confirmBtn.html(opt.confirmText);
            }

            if (opt.cancelText) {
                this._cancelBtn.html(opt.cancelText);
            }

            return self;
        },

        setContent: function(html){
            this.event.fire('willUpdateContent', [this]);
            this.superMethod('setContent', [html]);
            this.event.fire('updateContent', [this]);
            return this;
        },

        _setIframeContent: function(){
            var self = this;
            this._clearIframeContent();
            self.setContent('');
            self.showLoading();
            self._iframeContent = $('<iframe class="moui-modalview-iframebd" '
                    + 'frameborder="0" scrolling="no" style="visibility:hidden;width:100%;">'
                    + '</iframe>')
                .bind('load', function(){
                    try {
                        if (!this.contentWindow.document.body.innerHTML) {
                            return;
                        }
                        self._iframeWindow = $(this.contentWindow);
                        if (!self._iframeContent
                            && self._iframeWindow[0].location.href !== self._config.iframe) {
                            return;
                        }
                        self._iframeContent[0].style.visibility = '';
                        self.event.resolve("frameOnload", [self]);
                        self.hideLoading();
                    } catch(ex) {}
                }).appendTo(self._content);
        },

        _clearIframeContent: function(){
            if (this._iframeContent) {
                this._iframeContent.remove();
                this._iframeContent = null;
            }
            this.event.reset("frameOnload");
        },

        confirm: function(){
            this.event.fire('confirm', [this]);
            return this;
        },

        cancel: function(){
            this.event.fire('cancel', [this]);
            this.ok();
            return this;
        },

        ok: function(){
            this.close();
            return this.event.promise('close');
        },

        applyOpen: function(){
            var re = this.superMethod('applyOpen', arguments);
            if (this._config.iframe) {
                this._iframeContent.attr('src', this._config.iframe);
            }
            return re;
        },

        applyClose: function(){
            this._clearIframeContent();
            this._contentWrapper[0].scrollTop = 0;
            return this.superMethod('applyClose', arguments);
        },

        beforeClose: function(){
            this.setContent('');
        }

    });

    ModalView.prototype.done = ModalView.prototype.ok;

    function exports(opt) {
        return new exports.ModalView(opt);
    }

    exports.ModalView = ModalView;

    return exports;

});

/* @source cardkit/ui/modalview.js */;

define("cardkit/ui/modalview", [
  "mo/lang",
  "dollar",
  "moui/modalview"
], function(_, $, originModal) {

var default_config = {
        className: 'ck-modalview',
        openDelay: 400,
        closeDelay: 400,
        oldStylePage: false,
        contentFilter: false
    },
    SCRIPT_TYPES = {
        'text/modalview-javascript': 1,
        'text/cardscript': 1, // @deprecated
        'text/jscode': 1 // @deprecated
    },
    singleton;

var ModalView = _.construct(originModal.ModalView);

_.mix(ModalView.prototype, {

    _defaults: _.mix({}, ModalView.prototype._defaults, default_config),

    init: function() {
        this.superMethod('init', arguments);
        this.event.bind('confirm', function(modal){
            modal.event.fire('confirmOnThis', arguments);
        }).bind('close', function(modal){
            modal.event.unbind('confirmOnThis');
        });
        return this;
    },

    set: function(opt){
        if (!opt) {
            return this;
        }

        if (opt.iframeUrl) {
            opt.iframe = opt.iframeUrl;
        }

        if (opt.source) {
            opt.content = $('.' + opt.source).map(function(elm){
                var type = $(elm).attr('type');
                if (SCRIPT_TYPES[type]) {
                    return '<script type="text/darkscript">' 
                        + elm.innerHTML + '</script>';
                } else {
                    return elm.innerHTML;
                }
            }).join('');
        }

        var re = this.superMethod('set', [opt]);

        if (!this.pageNode()[0]) {
            this._content.append(this.wrapPageContent('<div></div>'));
        }

        return re;
    },

    setContent: function(html){
        if (html) {
            var filter = this._config.contentFilter;
            if (filter) {
                html = (new RegExp(filter).exec(html) || [])[1];
            }
            html = this.wrapPageContent(html);
        }
        return this.superMethod('setContent', [html]);
    },

    pageNode: function(){
        return this._content.find('.ck-modal-page');
    },

    wrapPageContent: function(html){
        var oldstyle = this._config.oldStylePage;
        var page_start = oldstyle 
            ? '<div class="ckd-page-card ck-modal-page" ' 
                + 'data-cfg-deck="modalview" '
                + 'id="ckPage-' + this.id + '">'
            : '<ck-card type="page" class="ck-modal-page" ' 
                + 'deck="modalview" '
                + 'id="ckPageOld-' + this.id + '">';
        var page_end = oldstyle ? '</div>' : '</ck-card>';
        return page_start + html + page_end;
    }

});

function exports(opt) {
    if (!singleton) {
        singleton = new exports.ModalView(opt);
    }
    return singleton;
}

exports.ModalView = ModalView;

return exports;

});

/* @source moui/ranger.js */;

/**
 * Moui
 * OO-based UI behavior modules behind CardKit(mobile webapp framework)'s view components
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2013, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('moui/ranger', [
  "mo/lang",
  "dollar",
  "eventmaster"
], function(_, $, event){

    var default_config = {
            max: 100,
            min: 0,
            step: 1
        };

    function Ranger(elm, opt){
        this.init(elm, opt);
        this.set(this._config);
    }

    Ranger.prototype = {

        _defaults: default_config,

        init: function(elm, opt){
            this.event = event();
            var node = this._node = $(elm);
            opt = _.mix({
                max: node.attr('max') || undefined,
                min: node.attr('min') || undefined,
                step: node.attr('step') || undefined
            }, this.data(), opt);
            this._config = _.config({}, opt, this._defaults);
            this.val(node.val());
            return this;
        },

        set: function(opt){
            if (!opt) {
                return this;
            }
            _.config(this._config, opt, this._defaults);
            return this;
        },

        data: function(){
            return this._node.data();
        },

        val: function(v){
            if (v !== undefined) {
                var l = this._config.step.toString().replace(/.*\./, '').length;
                v = Math.floor(v * Math.pow(10, l)) / Math.pow(10, l);
                this._value = v;
                this.event.fire('change', [this.val(), this]);
            }
            return this._value;
        },

        progress: function(v){
            if (v !== undefined) {
                var cfg = this._config;
                if (v == 0) {
                    this.val(cfg.min);
                } else if (v == 1) {
                    this.val(cfg.max);
                } else {
                    var current = (cfg.max - cfg.min) * v + parseFloat(cfg.min);
                    current = Math.round(current / cfg.step) * cfg.step;
                    this.val(current);
                }
            }
            return this.val();
        },

        changeStart: function(){
            this._originValue = this._value;
            this.event.fire('changeStart', [this]);
        },

        changeEnd: function(){
            this.event.fire('changeEnd', [this]);
            if (this._originValue != this._value) {
                this.event.fire('changed', [this]);
            }
        }

    };

    function exports(elm, opt){
        return new exports.Ranger(elm, opt);
    }

    exports.Ranger = Ranger;

    return exports;

});

/* @source cardkit/ui/ranger.js */;

define("cardkit/ui/ranger", [
  "moui/ranger",
  "cardkit/bus",
  "cardkit/ui/growl",
  "cardkit/ui/util"
], function(ranger, bus, growl, util){

return util.singleton({

    flag: '_ckRangerUid',

    customOptions: {
        enableNotify: true
    },

    factory: function(elm, opt){
        return ranger(elm, opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.notify = o._config.enableNotify ? growl({
            parent: source.parent(),
            corner: 'stick'
        }) : null;
        o.event.bind('change', function(v){
            if (o.notify) {
                o.notify.set({
                    content: v
                }).open();
            }
        }).bind('changed', function(){
            var url = source.trigger('ranger:changed', {
                component: o
            }).data('url');
            bus.fire('ranger:changed', [o, url]);
        }).bind('changeEnd', function(){
            if (o.notify) {
                o.notify.close();
            }
        });
    }

});

});

/* @source cardkit/ui/picker.js */;

define("cardkit/ui/picker", [
  "mo/lang",
  "moui/picker",
  "cardkit/ui/util"
], function(_, picker, util) {

_.mix(picker.Picker.prototype._defaults, {
    disableRequest: false
});

return util.singleton({

    flag: '_ckPickerUid',

    factory: function(elm, opt){
        return picker(elm, opt);
    },

    defaultOptions: {
        options: '.ck-option'
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.event.bind('change', function(o, controller){
            var cfg = controller.data(), 
                eprops = {
                    component: o 
                },
                req_opt;
            if (!o._config.disableRequest) {
                o.showLoading();
                if (controller.isEnabled) {
                    req_opt = {
                        method: cfg.enableMethod,
                        url: cfg.enableUrl,
                        jsonUrl: cfg.enableJsonUrl
                    };
                } else {
                    req_opt = {
                        method: cfg.disableMethod,
                        url: cfg.disableUrl,
                        jsonUrl: cfg.disableJsonUrl
                    };
                }
                util.request({
                    config: req_opt,
                    callback: function(data, status){
                        o.hideLoading();
                        if (status === 'success') {
                            o.responseData = data;
                            source.trigger('picker:response', eprops);
                        }
                    }
                });
            }
            source.trigger('picker:change', eprops);
        });
    }

});

});

/* @source cardkit/ui/control.js */;

define("cardkit/ui/control", [
  "mo/lang",
  "moui/control",
  "cardkit/ui/util"
], function(_, control, util) {

var default_config = {
    disableRequest: false,
    enableUrl: '',
    enableJsonUrl: '',
    enableMethod: 'post',
    disableUrl: '',
    disableJsonUrl: '',
    disableMethod: 'post'
};

var CkControl = _.construct(control.Control);

_.mix(CkControl.prototype, {

    _defaults: _.mix({}, CkControl.prototype._defaults, default_config),

    enable: function(){
        var cfg = this._config;
        return this.request({
            method: cfg.enableMethod,
            url: cfg.enableUrl,
            jsonUrl: cfg.enableJsonUrl
        }, function(){
            this.superClass.enable.call(this);
        });
    },

    disable: function(){
        var cfg = this._config;
        return this.request({
            method: cfg.disableMethod,
            url: cfg.disableUrl,
            jsonUrl: cfg.disableJsonUrl
        }, function(){
            this.superClass.disable.call(this);
        });
    },

    request: function(cfg, fn){
        var self = this;
        var cb = function(data, status){
            if (status === 'success') {
                self.responseData = data;
            }
            self.hideLoading();
            fn.call(self);
        };
        if (!this._config.disableRequest) {
            util.request({
                config: cfg,
                before: function(){
                    self.showLoading();
                },
                callback: cb
            });
        } else {
            cb();
        }
        return this;
    }

});

var exports = util.singleton({

    flag: '_ckControlUid',

    factory: function(elm, opt){
        return new exports.Control(elm, opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.event.bind('enable', function(o){
            source.trigger('control:enable', {
                component: o
            });
        }).bind('disable', function(o){
            source.trigger('control:disable', {
                component: o
            });
        });
    }

});

exports.Control = CkControl;

return exports;

});

/* @source momo/base.js */;

/**
 * Momo (MoMotion)
 * A framework and a collection for separate and simple implementation of touch gestures
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('momo/base', [
  "mo/lang/es5",
  "mo/lang/type",
  "mo/lang/mix"
], function(es5, type, _){

    var isFunction = type.isFunction,
        gid = 0,

        SUPPORT_TOUCH = false;

    try {
        document.createEvent("TouchEvent");  
        SUPPORT_TOUCH = true;
    } catch (e) {}

    function MomoBase(elm, opt, cb){
        if (!opt || isFunction(opt)) {
            cb = opt;
            opt = {};
        }
        this._listener = cb;
        var eid = cb && ++gid;
        this.event = {};
        this.EVENTS.forEach(function(ev){
            this[ev] = ev + (cb ? '_' + eid : '');
        }, this.event);
        this.node = elm;
        this._config = {
            event: this.EVENTS[0]
        };
        this.config(opt);
        this.enable();
    }

    MomoBase.prototype = {

        SUPPORT_TOUCH: SUPPORT_TOUCH,

        PRESS: SUPPORT_TOUCH ? 'touchstart' : 'mousedown',
        MOVE: SUPPORT_TOUCH ? 'touchmove' : 'mousemove',
        RELEASE: SUPPORT_TOUCH ? 'touchend' : 'mouseup',
        CANCEL: 'touchcancel',

        EVENTS: [],
        DEFAULT_CONFIG: {
            namespace: ''
        },

        config: function(opt){
            var old_ns = this._config.namespace;
            _.merge(_.mix(this._config, opt), this.DEFAULT_CONFIG);

            var ns = this._config.namespace || '';
            this.EVENTS.forEach(function(ev){
                this[ev] = this[ev].replace(old_ns || /^/, ns);
            }, this.event);

            return this;
        },

        enable: function(){
            var self = this;
            self.bind(self.PRESS, 
                self._press || (self._press = function(e){
                    return self.press.call(self, e.originalEvent || e);
                })
            ).bind(self.MOVE, 
                self._move || (self._move = function(e){
                    return self.move.call(self, e.originalEvent || e);
                })
            ).bind(self.CANCEL, 
                self._cancel || (self._cancel = function(e){
                    return self.cancel.call(self, e.originalEvent || e);
                })
            ).bind(self.RELEASE, 
                self._release || (self._release = function(e){
                    return self.release.call(self, e.originalEvent || e);
                })
            );
            if (self._listener) {
                self.bind(this.event[this._config.event], 
                    self._handler || (self._handler = function(e){
                        return self._listener.call(self, e.originalEvent || e);
                    })
                );
            }
            return self;
        },

        disable: function(){
            var self = this;
            self.unbind(self.PRESS, self._press)
                .unbind(self.MOVE, self._move)
                .unbind(self.CANCEL, self._cancel)
                .unbind(self.RELEASE, self._release);
            if (self._listener && self._handler) {
                self.unbind(this.event[this._config.event], self._handler);
            }
            return self;
        },

        once: function(ev, handler, node){
            var self = this;
            this.bind(ev, fn, node);
            function fn(e){
                self.unbind(ev, fn, node);
                return handler.call(this, e.originalEvent || e);
            }
        },

        // adapter

        bind: nothing,

        unbind: nothing,

        trigger: nothing,

        // hook

        press: nothing,

        move: nothing,

        release: nothing,

        cancel: nothing
    
    };

    function nothing(){ return this; }

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoBase;

    return exports;

});

/* @source momo/tap.js */;

/**
 * Momo (MoMotion)
 * A framework and a collection for separate and simple implementation of touch gestures
 * 
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('momo/tap', [
  "mo/lang",
  "momo/base"
], function(_, momoBase){

    var MomoTap = _.construct(momoBase.Class);

    _.mix(MomoTap.prototype, {

        EVENTS: ['tap', 'doubletap', 'hold', 'tapstart', 'tapcancel'],
        DEFAULT_CONFIG: {
            'tapRadius': 10,
            'doubleTimeout': 300,
            'tapThreshold': 0,
            'holdThreshold': 500
        },

        press: function(e){
            var self = this,
                t = self.SUPPORT_TOUCH ? e.touches[0] : e;
            self._startTime = e.timeStamp;
            self._startTarget = t.target;
            self._startPosX = t.clientX;
            self._startPosY = t.clientY;
            self._movePosX = self._movePosY = self._moveTarget = NaN;
            self._started = false;
            self._pressTrigger = function(){
                self._started = true;
                self.trigger(e, self.event.tapstart);
                self._pressTrigger = nothing;
            };
            self._activeTimer = setTimeout(function(){
                if (!is_moved(self)) {
                    self._pressTrigger();
                }
            }, self._config.tapThreshold);
        },

        move: function(e){
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this._moveTarget = t.target;
            this._movePosX = t.clientX;
            this._movePosY = t.clientY;
        },

        release: function(e){
            var self = this,
                tm = e.timeStamp,
                moved = is_moved(self);
            clearTimeout(self._activeTimer);
            if (moved || tm - self._startTime < self._config.tapThreshold) {
                if (!moved) {
                    self._firstTap = tm;
                }
                if (self._started) {
                    self.trigger(e, self.event.tapcancel);
                }
                return;
            }
            if (!self._started) {
                self._pressTrigger();
            }
            if (tm - self._startTime > self._config.holdThreshold + self._config.tapThreshold) {
                self.trigger(e, self.event.hold);
            } else {
                if (self._firstTap
                        && (tm - self._firstTap < self._config.doubleTimeout)) {
                    e.preventDefault();
                    self.trigger(e, self.event.doubletap);
                    self._firstTap = 0;
                } else {
                    self.trigger(e, self.event.tap);
                    self._firstTap = tm;
                }
            }
        },

        cancel: function(e){
            clearTimeout(this._activeTimer);
            if (this._started) {
                this.trigger(e, this.event.tapcancel);
            }
        }
    
    });

    function is_moved(self){
        if (self._moveTarget && self._moveTarget !== self._startTarget 
                || Math.abs(self._movePosX - self._startPosX) > self._config.tapRadius
                || Math.abs(self._movePosY - self._startPosY) > self._config.tapRadius) {
            return true;
        }
    }

    function nothing(){}

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoTap;

    return exports;

});

/* @source soviet.js */;

/**
 * SovietJS
* Standalone UI event delegate implementation
* Provide multiple styles/modes: override, automatically preventDefault, partial matching, exact matching...
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define('soviet', [
  "mo/lang/es5",
  "mo/lang/mix",
  "mo/lang/type",
  "mo/lang/struct",
  "dollar"
], function(es5, _, type, struct, $){

    var fnQueue = struct.fnQueue,
        isFunction = type.isFunction,
        _matches_selector = $.find.matchesSelector,
        _default_config = {
            preventDefault: false,
            matchesSelector: false,
            autoOverride: false,
            aliasEvents: {}, 
            trace: false,
            traceStack: null
        };

    function Soviet(elm, opt){
        _.config(this, opt || {}, _default_config);
        this.target = $(elm);
        this.events = {};
        this.locks = {};
        if (!this.traceStack) {
            this.traceStack = [];
        }
    }

    Soviet.prototype = {

        on: function(event, selector, handler){
            if (isFunction(selector)) {
                handler = selector;
                selector = undefined;
            }
            if (typeof selector === 'object') {
                for (var i in selector) {
                    this.on(event, i, selector[i]);
                }
            } else {
                event = this.aliasEvents[event] || event;
                var table = this.events[event];
                if (!table) {
                    this.target.bind(event, this.trigger.bind(this));
                    this.reset(event);
                    table = this.events[event];
                }
                _accessor.call(this, table, selector, 
                    handler, _add_handler);
            }
            return this;
        },

        off: function(event, selector, handler){
            if (isFunction(selector)) {
                handler = selector;
                selector = undefined;
            }
            event = this.aliasEvents[event] || event;
            var table = this.events[event];
            if (table) {
                _accessor.call(this, table, selector,
                    handler, _remove_handler);
            }
            return this;
        },

        matches: function(event, selector){
            event = this.aliasEvents[event] || event;
            var table = this.events[event];
            return _accessor.call(this, table, selector,
                null, _get_handler);
        },

        reset: function(event){
            if (event) {
                event = this.aliasEvents[event] || event;
                this.events[event] = this.matchesSelector ? {}
                    : { '.': {}, '#': {}, '&': {} };
                _set_lock.call(this, event);
            } else {
                this.events = {};
                this.locks = {};
            }
            return this;
        },

        disable: function(event, selector){
            var locks = this.locks;
            if (event) {
                event = this.aliasEvents[event] || event;
                var lock = locks[event];
                if (!lock) {
                    lock = _set_lock.call(this, event);
                }
                if (selector) {
                    _accessor.call(this, lock, selector, 
                        true, _add_handler, true);
                } else {
                    lock._disable = true;
                }
            } else {
                this._global_lock = true;
            }
            return this;
        },

        enable: function(event, selector){
            var locks = this.locks;
            if (event) {
                event = this.aliasEvents[event] || event;
                var lock = locks[event];
                if (lock) {
                    if (selector) {
                        _accessor.call(this, lock, selector, 
                            null, _remove_handler, true);
                    } else {
                        delete lock._disable;
                    }
                }
            } else {
                delete this._global_lock;
            }
            return this;
        },

        trigger: function(e){
            var event = this.aliasEvents[e.type];
            if (event) {
                e.type = event;
            }
            var self = this,
                result,
                t = e.target, 
                locks = this.locks[e.type] || {},
                table = this.events[e.type];
            if (!table || this._global_lock || locks._disable) {
                return result;
            }
            if (this.matchesSelector) {
                Object.keys(table).forEach(function(selector){
                    if (!locks[selector] && _matches_selector(this, selector)) {
                        result = _run_handler.call(self, 
                            table[selector], this, e);
                    }
                }, t);
            } else {
                var pre, expr;
                var handler = (pre = '#') && (expr = t.id) && table[pre][expr] 
                    || (pre = '.') && (expr = t.className) && table[pre][expr] 
                    || (pre = '&') && (expr = t.nodeName.toLowerCase()) 
                        && table[pre][expr] 
                    || null;
                if (handler) {
                    var lock = locks[pre][expr];
                    if (!lock) {
                        result = _run_handler.call(this, handler, t, e);
                    }
                }
            }
            if (table._self_) {
                result = _run_handler.call(this, table._self_, t, e);
            }
            return result;
        }
    
    };

    function _run_handler(handler, t, e){
        var result;
        if (handler) {
            if (this.trace) {
                this.traceStack.unshift('<' + t.nodeName 
                    + '#' + (t.id || '') + '>.' 
                    + (t.className || '').split(/\s+/).join('.'));
                if (this.traceStack.length > this.trace) {
                    this.traceStack.pop();
                }
            }
            result = handler.call(t, e);
            if (this.preventDefault && !result) { 
                e.preventDefault();
            }
        }
        return result;
    }

    function _add_handler(lib, key, handler, override){
        var old = lib[key];
        if (override) {
            lib[key] = handler;
        } else if (handler) {
            if (!old) {
                old = lib[key] = fnQueue();
            }
            old.push(handler);
        }
    }

    function _remove_handler(lib, key, handler, override){
        var old = lib[key];
        if (!handler || override) {
            delete lib[key];
        } else if (old) {
            old.clear(handler);
        }
    }

    function _get_handler(lib, key){
        return lib[key];
    }

    function _set_lock(event){
        return this.locks[event] = this.matchesSelector ? {}
            : { '.': {}, '#': {}, '&': {} };
    }

    function _accessor(table, selector, handler, fn, override){
        if (override === undefined) {
            override = this.autoOverride;
        }
        if (!selector) {
            selector = '_self_';
        } else if (!this.matchesSelector) {
            var prefix = (/^[\.#]/.exec(selector) || ['&'])[0];
            selector = selector.substr(prefix !== '&' ? 1 : 0);
            table = table[prefix];
            if ('.' === prefix) {
                selector = selector.split('.').join(' ');
            }
        }
        return fn(table, selector, handler, override);
    }

    var exports = function(elm, opt){
        return new exports.Soviet(elm, opt);
    };

    exports.Soviet = Soviet;

    return exports;

});

/* @source cardkit/ui.js */;


define("cardkit/ui", [
  "mo/lang",
  "dollar",
  "mo/browsers",
  "mo/template",
  "mo/network",
  "soviet",
  "momo/base",
  "momo/tap",
  "cardkit/ui/control",
  "cardkit/ui/picker",
  "cardkit/ui/ranger",
  "cardkit/ui/modalview",
  "cardkit/ui/actionview",
  "cardkit/ui/growl",
  "cardkit/supports",
  "cardkit/bus"
], function(_, $, browsers, tpl, net, soviet, 
    momoBase, momoTap,
    control, picker, ranger, 
    modalView, actionView, growl, supports, bus){

var doc = document,
    modalCard = modalView(),
    _modal_tm,
    _soviet_aliases = {},
    _soviet_opt = {
        aliasEvents: _soviet_aliases,
        autoOverride: true,
        matchesSelector: true,
        preventDefault: true
    },
    _delegate = soviet(doc, _soviet_opt);

var BrightSoviet = _.construct(soviet.Soviet);

BrightSoviet.prototype.on = function(event, selector, handler){
    if (typeof selector === 'string'
            && !/dd-autogen/.test(selector)) {
        selector = '[dd-autogen] ' + selector;
    }
    return this.superMethod('on', [event, selector, handler]);
};

var DarkSoviet = _.construct(soviet.Soviet);

DarkSoviet.prototype.on = function(event, selector, handler){
    if (typeof selector === 'string'
            && !/dd-connect/.test(selector)) {
        selector = '[dd-connect] ' + selector;
    }
    return this.superMethod('on', [event, selector, handler]);
};

_.mix(momoBase.Class.prototype, {
    bind: function(ev, handler, elm){
        $(elm || this.node).bind(ev, handler);
        return this;
    },
    unbind: function(ev, handler, elm){
        $(elm || this.node).unbind(ev, handler);
        return this;
    },
    trigger: function(e, ev){
        delete e.layerX;
        delete e.layerY;
        delete e.returnValue;
        $(e.target).trigger(ev, e);
        return this;
    }
});

var tap_events = {

    '.ck-link, .ck-link *': function(){
        actions.openLink(this);
    },

    '.ck-link-direct, .ck-link-direct *': function(){ // @deprecated
        actions.openLink(this);
    },

    '.ck-link-extern, ck-link-extern *': function(){
        actions.openLink(this, {
            target: this.target || '_blank'
        });
    },

    '.ck-link-img': function(){
        actions.openImage(this.href);
    },

    // control

    '.ck-post-link': handle_control,

    '.ck-post-button, .ck-post-button span': tap_ck_post,

    '.ck-folder header': function(){
        control(this.parentNode).toggle();
    },

    '.ck-switch, .ck-switch span': tap_ck_switch,

    // picker

    '.ck-segment .ck-option, .ck-segment .ck-option span': function(){
        var btn = $(this);
        if (!btn.hasClass('ck-option')) {
            btn = btn.closest('.ck-option');
        }
        var p = picker(btn.parent());
        p.select(btn);
    },

    '.ck-select, .ck-select span, .ck-select .enabled': function(){
        var me = $(this);
        if (!me.hasClass('ck-select')) {
            me = me.parent();
        }
        var p = picker(me);
        show_actions(me);
        bus.on('actionView:confirmOnThis', function(actionWindow){
            actions.updatePicker(p, actionWindow.val());
            me.trigger('selector:change', {
                component: p
            });
        });
    },

    '.ck-tagselector .ck-option': function(){
        var p = picker(this.parentNode);
        p.select(this);
    },

    '.ck-actions .ck-option': function(){
        var acts = $(this).closest('.ck-actions');
        var p = picker(acts, {
            ignoreStatus: acts.data("ignoreStatus") !== 'false' && true
        });
        p.select(this);
    },

    '.ck-actions-button, .ck-actions-button span': function(){
        var me = $(this);
        if (!me.hasClass('ck-actions-button')) {
            me = me.parent();
        }
        show_actions(me);
    },

    // modalView

    '.ck-modal-button, .ck-modal-button *': function(){
        var me = $(this);
        if (!me.hasClass('ck-modal-button')) {
            me = me.closest('.ck-modal-button');
        }
        actions.openModal(me.data());
    },

    '.ck-modal-link, .ck-modal-link *': function(){
        var me = $(this);
        if (!me.hasClass('ck-modal-link')) {
            me = me.closest('.ck-modal-link');
        }
        actions.openModal(me.data());
    },

    '.ck-modalview .wrapper > header .confirm': function(){
        modalCard.confirm();
    },

    '.ck-modalview .wrapper > header .cancel': function(){
        modalCard.cancel();
    },

    // actionView

    '.ck-actionview .ck-option, .ck-actionview .ck-option > *': function(){
        var me = $(this);
        if (!me.hasClass('ck-option')) {
            me = me.parent();
        }
        actionView.current.select(me);
    },

    '.ck-actionview > footer .confirm': function(){
        actionView.current.confirm();
    },

    '.ck-actionview > footer .cancel': function(){
        actionView.current.cancel();
    },

    '.ck-top-overflow': function(){
        show_actions($(this));
    },

    '.ck-confirm-link': function(){
        var me = this;
        if (!me.href) {
            me = me.parentNode;
        }
        actions.confirm('', function(){
            actions.openLink(me.href, me.target);
        }, $(me).data());
    },

    // growl 

    '.ck-growl-button': function(){
        growl(this).open();
    }

};

bus.on('ranger:changed', function(ranger, url){
    if (url) {
        actions.openLink(tpl.format(url, {
            value: ranger.val()
        }));
    }
});

bus.on('actionView:jump', function(actionCard, href, target){
    actions.openLink(href, {
        target: target
    });
});

var components = {
    control: control,
    picker: picker,
    ranger: ranger,
    modalCard: modalCard,
    modalView: modalView,
    actionView: actionView, 
    growl: growl
};

var actions = {

    alert: function(text, opt) {
        return actionView('ckAlert', _.mix({
            title: '提示',
            content: text || '',
            cancelText: '关闭',
            multiselect: false
        }, opt)).open();
    },

    confirm: function(text, cb, opt) {
        var re = actionView('ckAlert', _.mix({
            title: '提示',
            content: text || '',
            confirmText: '确认',
            cancelText: '取消',
            multiselect: true
        }, opt)).open();
        bus.on('actionView:confirmOnThis', cb);
        return re;
    },

    openModal: function(opt){
        var tm = +new Date(),
            url = opt.jsonUrl || opt.url;
        if (url) {
            actions.showLoading();
            _modal_tm = tm;
            if (opt.jsonUrl) {
                net.getJSON(url, callback);
            } else if (opt.url) {
                net.ajax({
                    url: url,
                    success: callback
                });
            }
        } else {
            modalCard.set(opt).open();
        }
        function callback(data){
            if (tm !== _modal_tm) {
                return;
            }
            if (opt.jsonUrl) {
                data = data.html;
            }
            opt.content = data;
            actions.hideLoading();
            modalCard.set(opt).open();
        }
    },

    closeModal: function(){
        _modal_tm = 0;
        modalCard.cancel();
        return modalCard.event.promise('close');
    },

    openImage: function(src){
        actions.openLink(src, {
            target: '_blank'
        });
    },

    notify: function(content, opt) {
        return growl(_.mix({
            content: content
        }, opt)).open();
    },

    showLoading: function(text){
        if (!this.loadingTips) {
            this.loadingTips = growl({
                expires: -1,
                keepalive: true,
                corner: 'center'
            });
        }
        this.loadingTips.set({
            content: text || '加载中...'
        }).open();
        this._loadingStart = +new Date();
    },

    hideLoading: function(opt){
        opt = _.mix({ duration: 800 }, opt);
        var d = +new Date() - this._loadingStart;
        if (d < opt.duration) {
            setTimeout(function(){
                actions.hideLoading(opt);
            }, opt.duration - d);
        } else {
            if (this.loadingTips) {
                this.loadingTips.close();
            }
        }
    },

    updatePicker: function(pickerObj, new_val){
        if (Array.isArray(new_val)) {
            var old_val = pickerObj.val();
            _.each(old_val, function(v){
                if (!this[v]) {
                    pickerObj.unselect(v);
                }
            }, _.index(new_val));
            _.each(new_val, function(v){
                if (!this[v]) {
                    pickerObj.select(v);
                }
            }, _.index(old_val));
        } else {
            pickerObj.select(new_val);
        }
    },

    openLink: function(href, opt){
        opt = opt || {};
        if (typeof href !== 'string') {
            var node = href;
            href = node.href;
            opt.target = opt.target || node.target;
        }
        if (opt.target && opt.target !== '_self') {
            window.open(href, opt.target);
        } else {
            location.href = href;
        }
    }

};

var exports = {

    init: function(opt){
        opt = opt || {};
        var wrapper = $(opt.appWrapper);
        actionView.forceOptions.parent = wrapper;
        growl.defaultOptions.parent = wrapper;
        modalCard.set({
            oldStylePage: opt.oldStyle,
            parent: wrapper
        });
        var tapGesture = momoTap(doc);
        set_alias_events(tapGesture.event);
        var prevent_click_events = {};
        Object.keys(tap_events).forEach(function(selector){
            this[selector] = nothing;
        }, prevent_click_events);
        _delegate.on('tap', tap_events)
            .on('click', prevent_click_events);
        this.brightDelegate.on('change', {
            '.ck-ranger': function(e){
                ranger(this).val(e.target.value);
                return true;
            }
        }).on('touchstart', {
            '.ck-ranger': function(e){
                ranger(this).val(e.target.value);
                ranger(this).changeStart();
                return true;
            }
        }).on('touchend', {
            '.ck-ranger': function(){
                ranger(this).changeEnd();
                return true;
            }
        });
    },

    brightDelegate: new BrightSoviet(doc, _soviet_opt),
    darkDelegate: new DarkSoviet(doc, _soviet_opt),

    action: actions,
    component: components

};

function handle_control(){
    var controller = control(this),
        cfg = controller.data();
    if (cfg.disableUrl || cfg.disableJsonUrl) {
        controller.toggle();
    } else if (!controller.isEnabled) {
        controller.enable();
    }
} 

function toggle_control(){
    control(this).toggle();
} 

function tap_ck_post(){
    if (!$(this).hasClass('ck-post-button')) {
        return tap_ck_post.call(this.parentNode);
    }
    handle_control.call(this);
}

function tap_ck_switch(){
    if (!$(this).hasClass('ck-switch')) {
        return tap_ck_switch.call(this.parentNode);
    }
    toggle_control.call(this);
}

function show_actions(me){
    var opt = _.mix({
        confirmText: '确认',
        cancelText: '取消',
        multiselect: false
    }, me.data());
    opt.options = $(opt.options || '.ck-option', me);
    return actionView(me, opt).open();
}

function set_alias_events(events) {
    for (var ev in events) {
        $.Event.aliases[ev] = _soviet_aliases[ev] = 'ck_' + events[ev];
    }
}

function nothing(){}

return exports;

});


/* @source darkdom.js */;

/**
 * DarkDOM 
 * Design your markup language on a higher level of abstraction than HTML
 * Build responsive cross-screen UI components
 * Better separation of concerns
 * Separate the presentation layer and business layer from the traditional content layer
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2013-2014, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */

/**
 * @module darkdom
 */
define('darkdom', [
  "mo/lang/es5",
  "mo/lang/mix",
  "dollar"
], function(es5, _, $){

var _defaults = {
        unique: false,
        enableSource: false,
        disableScript: false,
        entireAsContent: false,
        sourceAsContent: false,
        render: false
    },
    _default_states = {
        source: 'source-selector'
    },
    _content_buffer = {},
    _source_models = {},
    _dark_models = {},
    _guards = {},
    _updaters = {},
    _update_tm = 0,
    _tm = 0,
    _tuid = 0,
    _to_string = Object.prototype.toString,
    _is_array = Array.isArray,
    _matches_selector = $.find.matchesSelector,
    IS_BRIGHT = 'dd-autogen',
    MY_BRIGHT = 'dd-connect',
    ID_PREFIX = '_brightRoot_',
    RE_CONTENT_COM = new RegExp('\\{\\{' 
        + MY_BRIGHT + '=(\\w+)\\}\\}', 'g'),
    RE_EVENT_SEL = /(\S+)\s*(.*)/,
    RE_INNER = /(<[\s\S]+?>)([\s\S]*)(<.+>)/,
    RE_ATTR_ID = /(\sid=['"])[^"']*/,
    RE_ATTR_MARK = new RegExp('(' + IS_BRIGHT + "=['\"])[^'\"]*"),
    RE_HTMLTAG = /^\s*(<[\w\-]+)([^>]*)>/;

/**
 * @memberof module:darkdom
 * @alias DarkDOM
 * @class
 *
 * @desc Mixin class
 *
 * @see module:darkdom.DarkGuard#watch}
 * @see module:darkdom.initPlugins}
 *
 * @example 
 * $('x-folder').attr({
 *     mode: 'unfold'
 * }).updateDarkDOM();
 * // or $('x-folder')[0].updateDarkDOM();
 */
function DarkDOM(){}

DarkDOM.prototype = {

    /**
     * @public
     * @returns {DarkGuard} 
     */
    darkGuard: function(){
        return _guards[this.getAttribute(MY_BRIGHT)];
    },

    /**
     * @public
     * @see module:darkdom.DarkGuard#mount
     * @see module:darkdom.DarkGuard#mountRoot
     */
    mountDarkDOM: function(){
        var guard = this.darkGuard();
        if (guard) {
            guard.mountRoot(this);
        }
    },

    /**
     * @public
     * @see module:darkdom.DarkGuard#unmount
     * @see module:darkdom.DarkGuard#unmountRoot
     */
    unmountDarkDOM: function(){
        var guard = this.darkGuard();
        if (guard) {
            guard.unmountRoot(this);
        }
    },

    /**
     * [Unmount]{@link 
     * module:darkdom.DarkDOM#unmountDarkDOM} & [deregister]{@link 
     * module:darkdom.DarkGuard#unregisterRoot}
     *
     * @public
     * @see module:darkdom.DarkGuard#unmount
     * @see module:darkdom.DarkGuard#unwatch
     * @see module:darkdom.DarkGuard#unmountRoot
     * @see module:darkdom.DarkGuard#unregisterRoot
     */
    resetDarkDOM: function(){
        var guard = this.darkGuard();
        if (guard) {
            guard.unmountRoot(this);
            guard.unregisterRoot(this);
        }
    },

    /**
     * @example
     * var component = darkdom({ render: function(){} });
     *
     * var guard_A = component.createGuard();
     * guard_A.watch('x-folder');
     * guard_A.state('isFolded', 'data-folded');
     *
     * var guard_B = component.createGuard();
     * guard_B.watch('.x-folder');
     * guard_B.state('isFolded', function(node){
     *     return node.hasClass('folded');
     * });
     *
     * console.log($('x-folder').data('folded')); // (A1)
     * console.log($('x-folder').getDarkState('isFolded')); // (A1)
     *
     * console.log($('.x-folder').hasClass('folded')); // (B1)
     * console.log( // (B2)
     *     $('.x-folder').darkGuard().stateGetter('isFolded')(
     *         $('.x-folder')
     *     )
     * );
     * console.log($('.x-folder').getDarkState('isFolded')); // (B3)
     *
     * @public
     * @param {String} name - 
     * @see module:darkdom.DarkComponent#state
     * @see module:darkdom.DarkGuard#state
     */
    getDarkState: function(name){
        var guard = this.darkGuard();
        return guard
            && read_state($(this), guard.stateGetter(name))
            || null;
    },

    /**
     * @public
     * @param {String} name - 
     * @param {String|Function} value - 
     * @param {String} opt - 
     * @see module:darkdom.DarkDOM#getDarkState
     */
    setDarkState: function(name, value, opt){
        opt = opt || {};
        var guard = this.darkGuard();
        if (guard) {
            var setter = guard.stateSetter(name);
            write_state($(this), setter, value);
            if (opt.update) {
                this.updateDarkStates();
            }
        }
    },

    /**
     * High-performance version of [DarkDOM#updateDarkDOM]{@link 
     * module:darkdom.DarkDOM#updateDarkDOM}
     *
     * @public
     */
    updateDarkStates: function(opt){
        update_target(this, _.merge({
            onlyStates: true
        }, opt));
    },

    /**
     * @public
     */
    updateDarkDOM: function(opt){
        opt = opt || {};
        update_target(this, opt);
        if (!opt.ignoreRender) {
            exports.DarkGuard.gc();
        }
    },

    /**
     * @public
     */
    updateDarkSource: function(){
        var bright_id = this.getAttribute(MY_BRIGHT);
        delete _source_models[bright_id];
        this.updateDarkDOM();
    },

    /**
     * @example <caption>HTML(Jade syntax)</caption>
     * x-folder(mode="unfold")
     *   hd(source-selector=".source-data h1")
     * div(class="source-data")
     *   h1 The header A
     *
     * @example <caption>JS</caption>
     * $('x-folder').attr({
     *     mode: 'fold'
     * }).find('hd').feedDarkDOM({
     *     state: {
     *         label: 'The header B'
     *     }
     * }).end().updateDarkDOM();
     *
     * @public
     * @param {Function} fn - accepts {@link SourceModel}
     */
    feedDarkDOM: function(fn){
        var bright_id = this.getAttribute(MY_BRIGHT);
        update_source_model(bright_id, fn, true);
    },

    /**
     * @public
     */
    forwardDarkDOM: function(selector, handler){
        var bright_id = this.getAttribute(MY_BRIGHT);
        var guard = _guards[bright_id];
        var subject = bright_id + '|' + selector;
        mix_setter(selector, subject, guard._config.events);
        guard.forward(subject, handler);
        guard.registerEvents($('#' + bright_id), subject, selector);
    },

    /**
     * @public
     * @param {UpdateEventName} subject
     * @param {Function} handler - accepts {@link DarkModelChanges}
     */
    responseDarkDOM: function(subject, handler){
        var bright_id = this.getAttribute(MY_BRIGHT),
            updaters = _updaters[bright_id];
        if (!updaters) {
            updaters = _updaters[bright_id] = {};
        }
        updaters[subject] = handler;
    }

};

/**
 * @memberof module:darkdom
 * @alias DarkComponent
 * @class
 * @param {object}
 */
function DarkComponent(opt){
    opt = opt || {};
    this._config = _.config({}, opt, _defaults);
    this._stateGetters = _.copy(_default_states);
    this._stateSetters = _.copy(_default_states);
    this._components = {};
    this._contents = {};
    this._updaters = {};
    this._events = {};
    this.set(this._config);
}

DarkComponent.prototype = {

    /**
     * @public
     * @param {object}
     */
    set: function(opt){
        if (!opt) {
            return this;
        }
        _.config(this._config, opt, this._defaults);
        return this;
    },

    /**
     * @public
     * @param {string|object} name
     * @param {(function|string)} getter
     * @param {(function|string)} setter
     */
    state: function(name, getter, setter){
        if (typeof name === 'object') {
            _.each(name, function(getter, name){
                this.state(name, getter);
            }, this);
            return this;
        } 
        if (!setter && typeof getter === 'string') {
            return this.state(name, getter, getter);
        }
        if (_is_array(getter)) {
            return this.state(name, getter[0], getter[1]);
        }
        this._stateGetters[name] = getter;
        this._stateSetters[name] = setter;
        return this;
    },

    /**
     * @public
     */
    contain: function(name, component, opt){
        if (typeof name === 'object') {
            opt = component;
        }
        opt = opt || {};
        var dict = mix_setter(name, component, this._components, { 
            execFunc: true 
        });
        if (opt.content) {
            _.mix(this._contents, dict);
        }
        return this;
    },

    /**
     * @public
     */
    forward: function(selector, subject){
        mix_setter(selector, subject, this._events);
        return this;
    },

    /**
     * @public
     */
    response: function(subject, handler){
        this._updaters[subject] = handler;
        return this;
    },

    /**
     * @public
     */
    component: function(name){
        return this._components[name];
    },

    /**
     * @public
     */
    createGuard: function(opt){
        // @hotspot
        opt = opt || {};
        return new exports.DarkGuard({
            contextModel: opt.contextModel,
            contextTarget: opt.contextTarget,
            isSource: opt.isSource,
            stateGetters: this._stateGetters,
            stateSetters: this._stateSetters,
            components: this._components,
            contents: this._contents,
            updaters: this._updaters,
            events: this._events,
            options: this._config
        });
    }

};

/**
 * @memberof module:darkdom
 * @alias DarkGuard
 * @class
 */
function DarkGuard(opt){
    this._stateGetters = Object.create(opt.stateGetters);
    this._stateSetters = Object.create(opt.stateSetters);
    this._options = opt.options;
    this._config = opt;
    this._darkRoots = [];
    this._specs = {};
    this._buffer = [];
    this._events = {};
    this._sourceGuard = null;
}

DarkGuard.prototype = {

    /**
     * @borrows DarkComponent#state
     */
    state: DarkComponent.prototype.state,

    /**
     * @public
     */
    component: function(name, spec){
        mix_setter(name, spec, this._specs, {
            enableExtension: true
        });
        return this;
    },

    /**
     * @public
     */
    forward: function(subject, selector){
        mix_setter(subject, selector, this._events);
        return this;
    },

    /**
     * @public
     */
    source: function(){
        if (!this._options.enableSource) {
            return;
        }
        return this._sourceGuard
            || (this._sourceGuard = this.createSource(this._config));
    },

    /**
     * @public
     */
    stateGetter: function(name){
        return this._stateGetters[name];
    },

    /**
     * @public
     */
    stateSetter: function(name){
        return this._stateSetters[name];
    },

    /**
     * @public
     */
    watch: function(targets){
        this.selectTargets(targets)
            .forEach(this.registerRoot, this);
        return this;
    },

    /**
     * @public
     */
    unwatch: function(targets){
        targets = targets 
            ? this.selectTargets(targets)
            : this._darkRoots;
        targets.forEach(this.unregisterRoot, this);
        return this;
    },

    /**
     * @public
     */
    mount: function(){
        this._darkRoots.forEach(this.mountRoot, this);
        return this;
    },

    /**
     * @public
     */
    unmount: function(){
        this._darkRoots.forEach(this.unmountRoot, this);
        return this;
    },

    /**
     * @public
     */
    buffer: function(){
        this._darkRoots.forEach(this.bufferRoot, this);
        return this;
    },

    /**
     * @public
     */
    update: function(){
        this._darkRoots.forEach(this.updateRoot, this);
        return this;
    },

    gc: function(bright_id){
        _.each(this._darkRoots, function(elm){
            if (elm.getAttribute(MY_BRIGHT) === bright_id) {
                this.unregisterRoot(elm);
                return false;
            }
        }, this);
    },

    registerRoot: function(elm){
        // @hotspot
        if (elm.getAttribute(IS_BRIGHT)) {
            return;
        }
        var is_source = this._config.isSource;
        var bright_id = elm.getAttribute(MY_BRIGHT);
        if (!bright_id) {
            bright_id = uuid();
            if (!is_source) {
                elm.setAttribute(MY_BRIGHT, bright_id);
            }
        }
        if (!is_source
                && (elm.lastUpdateDarkDOM || 0) > _update_tm) {
            return bright_id;
        }
        _guards[bright_id] = this;
        if (!is_source) {
            var dom_api = DarkDOM.prototype;
            for (var name in dom_api) {
                elm[name] = dom_api[name];
            }
        } else {
            elm.isDarkSource = true;
        }
        this._darkRoots.push(elm);
        elm.lastUpdateDarkDOM = +new Date();
        return bright_id;
    },

    unregisterRoot: function(elm){
        var bright_id = elm.getAttribute(MY_BRIGHT);
        if (this !== _guards[bright_id]) {
            return;
        }
        elm.removeAttribute(MY_BRIGHT);
        unregister(bright_id);
        _.each(DarkDOM.prototype, function(method, name){
            delete this[name];
        }, elm);
        delete elm.lastUpdateDarkDOM;
        clear(this._darkRoots, elm);
    },

    mountRoot: function(elm){
        if (elm.getAttribute(IS_BRIGHT)
                || elm.isMountedDarkDOM) {
            return this;
        }
        var target = $(elm);
        target.trigger('darkdom:willMount');
        var dark_model = render_root(this.scanRoot(target));
        target.hide().after(this.render(dark_model));
        this._listen(dark_model);
        target[0].isMountedDarkDOM = true;
        run_script(dark_model);
        target.trigger('darkdom:rendered')
            .trigger('darkdom:mounted');
        return this;
    },

    unmountRoot: function(elm){
        var bright_id = elm.getAttribute(MY_BRIGHT);
        $('[' + MY_BRIGHT + ']', elm).forEach(function(child){
            var child_id = child.getAttribute(MY_BRIGHT);
            var guard = _guards[child_id];
            guard.unregisterRoot(child);
        }, _dark_models);
        $('#' + bright_id).remove();
        delete elm.isMountedDarkDOM;
        delete _dark_models[bright_id];
    },

    bufferRoot: function(elm){
        // @hotspot
        if (elm.getAttribute(IS_BRIGHT)) {
            return this;
        }
        var dark_model = this.scanRoot(elm); 
        this._bufferModel(dark_model);
        elm.isMountedDarkDOM = true;
        return this;
    },

    updateRoot: function(elm){
        elm.updateDarkDOM();
        return this;
    },

    scanRoot: function(target, opt){
        // @hotspot
        target = $(target);
        opt = opt || {};
        var is_source = this._config.isSource;
        var bright_id = is_source 
            ? this.registerRoot(target[0])
            : target.attr(MY_BRIGHT);
        var dark_model = {
            id: bright_id,
        };
        if (!is_source) {
            dark_model.context = this._config.contextModel;
        }
        dark_model.state = {};
        _.each(this._stateGetters, function(getter, name){
            this[name] = read_state(target, getter);
        }, dark_model.state);
        if (!opt.onlyStates) {
            this._scanComponents(dark_model, target);
        }
        if (!is_source
                && (dark_model.state.source 
                    || _source_models[bright_id])
                && this._options.enableSource) {
            this._mergeSource(dark_model, opt);
        }
        return dark_model;
    },

    _scanComponents: function(dark_model, target){
        var cfg = this._config, 
            opts = this._options,
            specs = this._specs, 
            guard_opt = {
                contextModel: dark_model,
                contextTarget: target,
                isSource: cfg.isSource
            },
            non_contents = {},
            re = {};
        _.each(cfg.components, function(component, name){
            if (!cfg.contents[name]) {
                non_contents[name] = component;
                return;
            }
            var guard = auto_guard(component, name);
            guard._bufferContent();
        });
        _.each(non_contents, function(component, name){
            var guard = auto_guard(component, name);
            re[name] = guard.releaseModel();
        });
        dark_model.componentData = re;
        dark_model.contentData = this._scanContents(target, {
            scriptContext: !opts.disableScript && target[0],
            entireAsContent: opts.entireAsContent,
            noComs: !Object.keys(cfg.components).length
        });
        function auto_guard(component, name){
            var guard = component.createGuard(guard_opt);
            var spec = specs[name];
            if (spec) {
                var last_fn = spec[spec.length - 1];
                if (typeof last_fn === 'string') {
                    guard.watch(last_fn);
                } else if (spec) {
                    exec_queue(spec, [guard, target]);
                }
            }
            guard.buffer();
            return guard;
        }
    },

    _scanContents: scan_contents,

    renderBuffer: function(){
        this._buffer.forEach(function(dark_model){
            render_root(dark_model);
        });
        return this;
    },

    releaseModel: function(){
        var re = this._buffer.slice();
        if (this._options.unique) {
            re = re[0] || {};
        }
        this._resetBuffer();
        return re;
    },

    _bufferModel: function(dark_model){
        this._buffer.push(dark_model);
    },

    _bufferContent: function(){
        this._buffer.forEach(function(dark_model){
            _content_buffer[dark_model.id] = dark_model;
        }, this);
        this._resetBuffer();
    },

    _resetBuffer: function(){
        this._buffer.length = 0;
        return this;
    },

    render: function(dark_model){
        var html = (this._options.render 
            || default_render)(dark_model);
        return html.replace(RE_HTMLTAG, function($0, $1, $2){
            var has_id, has_mark;
            $2 = $2.replace(RE_ATTR_ID, function($0, $1){
                has_id = true;
                return $1 + dark_model.id;
            });
            $2 = $2.replace(RE_ATTR_MARK, function($0, $1){
                has_mark = true;
                return $1 + 'true';
            });
            if (!has_id) {
                $2 = ' id="' + dark_model.id + '"' + $2;
            }
            if (!has_mark) {
                $2 = ' ' + IS_BRIGHT + '="true"' + $2;
            }
            return $1 + $2 + '>';
        });
    },

    _listen: function(dark_model){
        if (dark_model.id) {
            this.registerEvents($('#' + dark_model.id));
        }
        _.each(dark_model.componentData || {}, function(dark_modelset){
            if (_is_array(dark_modelset)) {
                return dark_modelset.forEach(this._listen, this);
            }
            this._listen(dark_modelset);
        }, this);
        var cd = dark_model.contentData;
        if (cd) {
            _.each(cd._index || {}, this._listen, this);
        }
    },

    selectTargets: function(targets){
        targets = $(targets, this._config.contextTarget);
        if (this._options.unique) {
            targets = targets.eq(0);
        }
        return targets;
    },

    triggerUpdate: function(changes){
        var handler;
        var subject = changes.type;
        var updaters = _updaters[changes.rootId] 
            || this._config.updaters;
        if (changes.name) {
            subject += ':' + changes.name;
            handler = updaters[subject];
        }
        if (!handler) {
            handler = updaters[changes.type];
        }
        if (!handler) {
            handler = this.defaultUpdater;
        }
        return handler.call(this, changes);
    },

    /**
     * @method
     */
    defaultUpdater: function(changes){
        var re = false;
        if (!changes.model) {
            changes.root.remove();
            return re;
        }
        if (changes.root[0]) {
            $(this.render(changes.model)).replaceAll(changes.root);
            this._listen(changes.model);
            return re;
        }
    },

    registerEvents: function(bright_root, subject, selector){
        var bright_id = bright_root.attr('id'),
            guard = _guards[bright_id];
        if (!guard) {
            return;
        }
        if (selector) {
            register.call(bright_root, subject, selector);
        } else {
            _.each(guard._config.events, register, bright_root);
        }
        function register(subject, bright_sel){
            bright_sel = RE_EVENT_SEL.exec(bright_sel);
            this.on(bright_sel[1], function(e){
                if (_matches_selector(e.target, bright_sel[2])) {
                    guard.triggerEvent(bright_id, subject, e);
                }
                return false;
            });
        }
    },

    triggerEvent: function(bright_id, subject, e){
        var dark_sel = this._events[subject];
        if (!dark_sel) {
            return;
        }
        var target = DarkGuard.getDarkById(bright_id);
        if (!target[0]) {
            return dark_sel(e, null, function(fn){
                update_source_model(bright_id, fn);
            });
        }
        if (typeof dark_sel !== 'string') {
            return dark_sel(e, target);
        }
        dark_sel = RE_EVENT_SEL.exec(dark_sel);
        if (dark_sel[2]) {
            target = target.find(dark_sel[2]);
        }
        target.trigger(dark_sel[1], {
            sourceEvent: e
        });
    },

    /**
     * @public
     */
    isSource: function(){
        return this._config.isSource;
    },

    createSource: function(opt){
        // @hotspot
        var i, options = opt.options,
            source_options = {};
        for (i in options) {
            source_options[i] = options[i];
        }
        source_options.entireAsContent = options.sourceAsContent 
            || options.entireAsContent;
        source_options.enableSource = false;
        var source_opt = {};
        for (i in opt) {
            source_opt[i] = opt[i];
        }
        source_opt.isSource = true;
        source_opt.contextTarget = null;
        source_opt.options = source_options;
        return new exports.DarkGuard(source_opt);
    },

    scanSource: function(bright_id, selector){
        if (!selector) {
            return;
        }
        var guard = this.source();
        guard._darkRoots.length = 0;
        var targets = guard.selectTargets(selector);
        guard.watch(targets);
        guard.buffer();
        var source_modelset = guard.releaseModel();
        guard.unwatch(targets);
        var source_model = source_modelset;
        if (_is_array(source_modelset)) {
            source_model = {};
            source_modelset.forEach(function(model){
                merge_source(this, model);
            }, source_model);
        }
        return source_model;
    },

    _mergeSource: function(dark_model, opt){
        var bright_id = dark_model.id;
        var source = _source_models[bright_id];
        if (!source) {
            source = this.scanSource(bright_id, dark_model.state.source);
            if (!source) {
                return;
            }
            _source_models[bright_id] = source;
        }
        if (opt.onlyStates) {
            merge_source_states(dark_model, source, dark_model.context);
        } else {
            merge_source(dark_model, source, dark_model.context);
        }
    }

};

/**
 * @param {string} bright_id - bright root's id
 * @returns {$}
 */
DarkGuard.getDarkById = function(bright_id){
    return $('[' + MY_BRIGHT + '="' + bright_id + '"]');
};

DarkGuard.getDarkByCustomId = function(custom_id){
    var re;
    _.each($('body #' + custom_id), function(node){
        if (!this(node, '[dd-autogen] #' + custom_id)) {
            re = $(node);
            return false;
        }
    }, $.matches);
    return re || $();
};

/**
 * @desc gc
 */
DarkGuard.gc = function(){
    var current = {};
    $('[' + MY_BRIGHT + ']').forEach(function(elm){
        this[elm.getAttribute(MY_BRIGHT)] = true;
    }, current);
    Object.keys(_guards).forEach(function(bright_id){
        if (this[bright_id] || $('#' + bright_id)[0]) {
            return;
        }
        var guard = _guards[bright_id];
        if (guard) {
            if (guard.isSource()) {
                return;
            }
            guard.gc(bright_id);
        } else {
            unregister(bright_id);
        }
    }, current);
};

init_plugins($);

/**
 * @memberof module:darkdom
 * @alias module:darkdom.initPlugins
 * @param {$} $
 * @desc Add DarkDOM API to Dollar/jQuery
 */
function init_plugins($){
    _.each(DarkDOM.prototype, function(method, name){
        this[name] = function(){
            var re;
            _.each(this, function(target){
                if (name in target) {
                    re = method.apply(target, this);
                }
            }, arguments);
            return re === undefined ? this : re;
        };
    }, $.fn);
}

function clear(list, target){
    var i = list.indexOf(target);
    if (i !== -1) {
        list.splice(i, 1);
    }
}

function uuid(){
    var now = +new Date();
    if (now > _tm) {
        _tm = now;
        _tuid = 0;
    }
    return ID_PREFIX + _tm + '_' + (++_tuid);
}

function unregister(bright_id){
    delete _guards[bright_id];
    delete _dark_models[bright_id];
    delete _source_models[bright_id];
    delete _updaters[bright_id];
}

function scan_contents(target, opt){
    opt = opt || {};
    var data = { 
        text: '',
        _index: {},
        _script: '',
        _context: opt.scriptContext,
        _hasOuter: opt.entireAsContent
    };
    if (!target) {
        return data;
    }
    opt.data = data;
    if (data._hasOuter) {
        content_spider.call(opt, 
            target.clone().removeAttr(MY_BRIGHT)[0]);
    } else {
        target.contents().forEach(content_spider, opt);
    }
    return data;
}

function content_spider(content){
    // @hotspot
    var data = this.data;
    if (content.nodeType !== 1) {
        if (content.nodeType === 3) {
            content = content.textContent || content.nodeValue;
            if (/\S/.test(content)) {
                data.text += content;
            }
        }
        return;
    } else if (data._context
            && content.nodeName === 'SCRIPT'
            && content.getAttribute('type') === 'text/darkscript') {
        data._script += content.innerHTML;
        return;
    }
    var mark = content.isMountedDarkDOM;
    if (this.noComs 
            && (!this.scriptContext
                || !content.getElementsByTagName('script').length)) {
        if (!mark) {
            data.text += content.outerHTML || '';
        }
        return;
    }
    var buffer_id = content.getAttribute(MY_BRIGHT),
        buffer = _content_buffer[buffer_id];
    delete _content_buffer[buffer_id];
    if (buffer) {
        data._index[buffer_id] = buffer;
        data.text += '{{' + MY_BRIGHT + '=' + buffer_id + '}}';
    } else if (!mark) {
        var childs_data = scan_contents($(content));
        var content_html = content.outerHTML || '';
        if (is_empty_object(childs_data._index)) {
            data.text += content_html;
        } else {
            data.text += content_html.replace(RE_INNER, 
                '$1' + childs_data.text + '$3');
            _.mix(data._index, childs_data._index);
        }
    }
}

function run_script(dark_model){
    if (typeof dark_model !== 'object') {
        return;
    }
    if (Array.isArray(dark_model)) {
        return dark_model.forEach(run_script);
    }
    var content = dark_model.contentData || {};
    if (content._script) {
        new Function('', content._script)
            .call(content._context);
    }
    _.each(content._index || {}, run_script);
    _.each(dark_model.componentData || {}, run_script);
}

function update_target(elm, opt){
    var bright_id = elm.getAttribute(MY_BRIGHT);
    if (!$.contains(document.body, elm)) {
        if (!opt.onlyStates && !opt.ignoreRender) {
            trigger_update(bright_id, null, {
                type: 'remove'
            });
        }
        return;
    }
    var guard = _guards[bright_id];
    var origin = _dark_models[bright_id];
    if (!guard || !origin) {
        return;
    }
    _update_tm = +new Date();
    var dark_modelset;
    if (opt.onlyStates) {
        dark_modelset = guard.scanRoot(elm, opt);
        _.merge(dark_modelset, origin);
        if (!opt.ignoreRender) {
            compare_states(origin, dark_modelset);
        }
        if (origin.state) {
            _.mix(origin.state, dark_modelset.state);
        }
    } else {
        dark_modelset = guard.bufferRoot(elm)
            .renderBuffer()
            .releaseModel();
        if (opt.ignoreRender) {
            return;
        }
        compare_model(origin, 
            _is_array(dark_modelset) 
                ? dark_modelset[0] : dark_modelset);
    }
}

function compare_model(origin, new_model){
    if (!new_model || !new_model.id) {
        return trigger_update(origin.id, null, {
            type: 'remove'
        });
    }
    if (!origin.id) {
        new_model = new_model.context;
        return trigger_update(new_model.id, new_model, {
            type: 'component'
        });
    }
    var abort = compare_states(origin, new_model);
    if (abort === false) {
        return;
    }
    if (compare_contents(
        origin.contentData 
            || (origin.contentData = scan_contents()), 
        new_model.contentData
    )) {
        abort = trigger_update(new_model.id, new_model, {
            type: 'content',
            oldValue: origin.content,
            newValue: new_model.content
        });
        if (abort === false) {
            return;
        }
    }
    _.each(new_model.componentData, function(new_modelset, name){
        var changed = compare_components.apply(this, arguments);
        if (changed) {
            abort = trigger_update(new_model.id, new_model, {
                type: 'component',
                name: name,
                oldValue: this[name],
                newValue: new_modelset 
            });
            if (abort === false) {
                return false;
            }
        }
    }, origin.componentData || (origin.componentData = {}));
}

function compare_states(origin, new_model){
    var abort;
    _.each(new_model.state, function(value, name){
        if (this[name] != value) {
            abort = trigger_update(new_model.id, new_model, {
                type: 'state',
                name: name,
                oldValue: this[name],
                newValue: value
            });
            if (abort === false) {
                return false;
            }
        }
    }, origin.state || (origin.state = {}));
    return abort;
}

function compare_contents(origin, new_content){
    if (origin.text.length !== new_content.text.length) {
        return true;
    }
    var changed;
    _.each(new_content._index || {}, function(new_content, bright_id){
        if (!this[bright_id]) {
            changed = true;
            return false;
        }
        compare_model(this[bright_id], new_content);
    }, origin._index);
    return changed || (origin.text !== new_content.text);
}

function compare_components(new_modelset, name){
    if (!_is_array(new_modelset)) {
        compare_model(this[name] || (this[name] = {}), 
            new_modelset);
        return;
    }
    var changed;
    var originset = this[name] || (this[name] = []);
    var larger = originset.length < new_modelset.length 
        ? new_modelset 
        : originset;
    for (var i = 0, l = larger.length; i < l; i++) {
        if (!originset[i]) {
            changed = true;
            break;
        }
        if (!new_modelset[i] 
                || originset[i].id === new_modelset[i].id) {
            compare_model(originset[i], new_modelset[i]);
        } else {
            changed = true;
            break;
        }
    }
    return changed;
}

function trigger_update(bright_id, dark_model, changes){
    if (!bright_id) {
        return;
    }
    var dark_root = DarkGuard.getDarkById(bright_id);
    dark_root.trigger('darkdom:willUpdate');
    var re, bright_root = $('#' + bright_id),
        guard = _guards[bright_id];
    if (guard) {
        re = guard.triggerUpdate(_.mix(changes, {
            model: dark_model,
            root: bright_root,
            rootId: bright_id
        }));
    } else if (!dark_model) {
        bright_root.remove();
        re = false;
    }
    if (!dark_model || changes.type === "remove") {
        dark_root.trigger('darkdom:removed');
    } else if (re === false) {
        dark_root.trigger('darkdom:rendered');
    }
    dark_root.trigger('darkdom:updated');
    return re;
}

function merge_source(dark_model, source_model, context){
    if (_is_array(source_model)) {
        source_model.forEach(function(source_model){
            merge_source(this, source_model, context);
        }, dark_model);
        return dark_model;
    }
    merge_source_states(dark_model, source_model, context);
    // @note
    var content = dark_model.contentData 
        || (dark_model.contentData = scan_contents());
    var source_content = source_model.contentData;
    if (source_content && source_content.text
            && (!content.text 
                || content._hasOuter)) {
        content.text = source_content.text; 
        _.mix(content._index, source_content._index);
    }
    // @note
    if (!dark_model.componentData) {
        dark_model.componentData = {};
    }
    _.each(source_model.componentData || {},
        merge_source_components, dark_model);
    return dark_model;
}

function merge_source_states(dark_model, source_model, context){
    if (_is_array(source_model)) {
        source_model.forEach(function(source_model){
            merge_source_states(this, source_model, context);
        }, dark_model);
        return dark_model;
    }
    if (!dark_model.id) {
        dark_model.id = source_model.id;
    }
    dark_model.context = context;
    _.each(source_model.state || {}, function(value, name){
        if (this[name] === undefined) {
            this[name] = value;
        }
    }, dark_model.state || (dark_model.state = {}));
    return dark_model;
}

function merge_source_components(source_modelset, name){
    var context = this;
    var origin = context.componentData;
    if (_is_array(source_modelset)) {
        var origin_list = [];
        (origin[name] || []).forEach(function(model){
            if (!is_source_model(model)) {
                this.push(model);
            }
        }, origin_list);
        source_modelset.forEach(function(source_model){
            this.push(merge_source({}, source_model, context));
        }, origin[name] = origin_list);
    } else {
        if (is_source_model(origin[name] || {})) {
            origin[name] = source_modelset;
        } else {
            merge_source(origin[name] || (origin[name] = {}), 
                source_modelset, context);
        }
    }
}

function is_source_model(model){
    var guard = _guards[model.id];
    return guard && guard.isSource();
}

function update_source_model(bright_id, fn, is_feed){
    var has_handler = is_function(fn);
    if (is_feed && !has_handler) {
        _source_models[bright_id] = setter(fn);
        return;
    }
    var source = find_root(bright_id);
    var is_child;
    if (!is_child) {
        _source_models[bright_id] = setter(source);
    } else {
        update_child(source);
    }
    function find_root(current_id){
        var root = _source_models[current_id];
        if (root) {
            return root;
        }
        is_child = true;
        current_id = _dark_models[current_id].context.id;
        return find_root(current_id);
    }
    function update_child(model){
        _.each(model.componentData, function(child, name){
            if (_is_array(child)){
                var re = true;
                _.each(child, function(child, i){
                    if (child.id === bright_id) {
                        this[i] = setter(child);
                        return re = false;
                    }
                }, child);
                return re;
            } else if (model.id === bright_id) {
                this[name] = setter(model);
                return false;
            }
            update_child(child);
        }, model);
    }
    function setter(model){
        var user_data = has_handler 
            ? (fn(model) || model) : fn;
        fix_userdata(user_data, _guards[bright_id].source());
        return user_data;
    }
}

function fix_userdata(data, guard){
    if (!data.id) {
        data.id = uuid();
        _guards[data.id] = guard;
    }
    if (!data.state) {
        data.state = {};
    }
    if (data.componentData) {
        _.each(guard._config.components, fix_userdata_component, {
            specs: guard._specs,
            data: data.componentData
        });
    } else {
        data.componentData = {};
    }
    if (data.contentData) {
        data.contentData._hasOuter = guard._options.sourceAsContent 
            || guard._options.entireAsContent;
    } else {
        data.contentData = {};
    }
}

function fix_userdata_component(component, name){
    var dataset = this.data[name];
    if (!dataset) {
        return;
    }
    if (!_is_array(dataset)) {
        dataset = [dataset];
    }
    var spec = this.specs[name];
    if (spec && typeof spec[spec.length - 1] === 'string') {
        spec = false;
    }
    dataset.forEach(function(data){
        var fake_parent = $();
        var user_guard = this.createGuard({
            contextTarget: fake_parent,
            isSource: true
        });
        if (spec) {
            exec_queue(spec, [user_guard, fake_parent]);
        }
        fix_userdata(data, user_guard);
    }, component);
}

function render_root(dark_model){
    _.each(dark_model.componentData, function(dark_modelset, name){
        if (_is_array(dark_modelset)) {
            this[name] = dark_modelset.map(function(dark_model){
                return this(dark_model);
            }, render_model);
        } else {
            this[name] = render_model(dark_modelset);
        }
    }, dark_model.component || (dark_model.component = {}));
    var content_data = dark_model.contentData;
    var index = content_data._index;
    var text = content_data.text;
    if (!is_empty_object(index)) {
        text = text.replace(RE_CONTENT_COM, function($0, bright_id){
            var dark_model = index[bright_id];
            if (typeof dark_model === 'string') {
                return dark_model;
            }
            return render_model(dark_model);
        });
    }
    dark_model.content = text;
    _dark_models[dark_model.id] = dark_model;
    return dark_model;
}

function render_model(dark_model){
    var guard = _guards[dark_model.id];
    if (!guard) {
        return '';
    }
    if (!dark_model.component) {
        dark_model = render_root(dark_model);
    }
    return guard.render(dark_model);
}

function read_state(target, getter){
    return (typeof getter === 'string' 
        ? target.attr(getter) 
        : getter && getter(target)) || undefined;
}

function write_state(target, setter, value){
    if (typeof setter === 'string') {
        target.attr(setter, value);
    } else if (setter) {
        setter(target, value);
    }
}

function default_render(dark_model){
    return '<span>' + dark_model.content + '</span>';
}

function is_function(obj) {
    return _to_string.call(obj) === "[object Function]";
}

function is_empty_object(obj) {
    for (var name in obj) {
        name = null;
        return false;
    }
    return true;
}

function mix_setter(key, value, context, opt){
    opt = opt || {};
    var dict = key;
    if (typeof dict !== 'object') {
        dict = {};
        dict[key] = value;
    }
    var re = {};
    _.each(dict, function(value, key){
        if (opt.execFunc && is_function(value)) {
            value = value(this[key]);
        }
        if (opt.enableExtension) {
            if (!this[key]) {
                this[key] = [];
            }
            if (!re[key]) {
                re[key] = [];
            }
            this[key].push(value);
            re[key].push(value);
        } else {
            this[key] = re[key] = value;
        }
    }, context);
    return re;
}

function exec_queue(queue, args){
    if (queue.length > 1) {
        queue.reduce(function(orig_fn, new_fn){
            return function(){
                var args = [].slice.call(arguments);
                args[args.length] = orig_fn;
                return new_fn.apply(this, args);
            };
        }).apply(this, args);
    } else {
        queue[0].apply(this, args);
    }
}

/**
 * @param {Object} opt - options
 */
function exports(opt){
    return new exports.DarkComponent(opt);
}

exports.DarkDOM = DarkDOM;
exports.DarkComponent = DarkComponent;
exports.DarkGuard = DarkGuard;
/** 
 * @method
 * @borrows DarkGuard.getDarkById 
 * @see module:darkdom.DarkGuard.getDarkById
 */
exports.getDarkById = DarkGuard.getDarkById;
/** 
 * @method
 * @borrows DarkGuard.getDarkByCustomId
 * @see module:darkdom.DarkGuard.getDarkByCustomId
 */
exports.getDarkByCustomId = DarkGuard.getDarkByCustomId;
/** 
 * @method
 * @borrows DarkGuard.gc
 * @see module:darkdom.DarkGuard.gc
 */
exports.gc = DarkGuard.gc;
exports.initPlugins = init_plugins;

return exports;

});

/* @source cardkit/helper.js */;


define("cardkit/helper", [
  "mo/lang",
  "dollar",
  "darkdom",
  "cardkit/ui"
], function(_, $, darkdom, ui){

var control = ui.component.control,
    picker = ui.component.picker,
    ranger = ui.component.ranger;

var exports = {

    readState: function(data, state){
        return data && (data.state || {})[state];
    },

    readSource: function(node){
        var source = node.data('source');
        return source && ('.' + source);
    },

    readLabel: function(node){
        var label = node.data('label');
        if (label) {
            label = node.find(label)[0];
        }
        label = $(label || node);
        return label.text() || label.val();
    },

    readClass: function(node){
        return node[0].className.split(/\s+/).filter(function(cname){
            return cname && !/^ckd\-/.test(cname);
        }).join(' ');
    },

    forwardStateEvents: function(component){
        component.forward({
            'control:enable *': 'control:enable',
            'control:disable *': 'control:disable',
            'picker:change *': 'picker:change',
            'picker:response *': 'picker:response',
            'selector:change *': 'selector:change',
            'ranger:changed *': 'ranger:changed'
        });
    },

    applyStateEvents: function(guard){
        guard.forward({
            'control:enable': apply_enable,
            'control:disable': apply_disable,
            'picker:change': apply_pick,
            'picker:response': apply_pick_response,
            'selector:change': apply_selector,
            'ranger:changed': apply_ranger
        });
    },

    forwardActionEvents: function(component){
        component.forward({
            'control:enable .ck-top-act > *': 'topControl:enable',
            'control:disable .ck-top-act > *': 'topControl:disable',
            'actionView:confirm .ck-top-overflow': 'topOverflow:confirm'
        });
    },

    applyActionEvents: function(guard){
        guard.forward({
            'topOverflow:confirm': apply_top_confirm,
            'topControl:enable': apply_top_enable,
            'topControl:disable': apply_top_disable
        });
    },

    forwardInputEvents: function(component){
        component.forward({
            'change select': 'select:change',
            'change input': 'input:change',
            'change textarea': 'input:change'
        });
    },

    applyInputEvents: function(guard){
        guard.forward({
            'select:change': apply_select,
            'input:change': apply_input
        });
    },

    isBlank: function(content){
        return !content || !/\S/m.test(content);
    }

};

var apply_enable = find_dark(enable_control);

var apply_disable = find_dark(disable_control);

var apply_pick = find_dark(function(node, e){
    var p = picker(node, _.merge({
        disableRequest: true
    }, e.component._config));
    var new_val = e.component.val();
    ui.action.updatePicker(p, new_val);
});

var apply_pick_response = find_dark(function(node, e){
    var p = picker(node, _.merge({}, e.component._config));
    p.responseData = e.component.responseData;
    node.trigger('picker:response', {
        component: p
    });
});

var apply_selector = find_dark(function(node, e){
    node.trigger('selector:change', {
        component: picker(node, _.merge({
            disableRequest: true
        }, e.component._config))
    });
});

var apply_ranger = find_dark(function(node, e){
    var o = ranger(node, _.merge({
        enableNotify: false
    }, e.component._config));
    var v = e.component.val();
    o.val(v).attr('value', v);
    node.trigger('ranger:changed', {
        component: o
    });
});

var apply_top_enable = find_top_dark(enable_control);

var apply_top_disable = find_top_dark(disable_control);

var apply_top_confirm = function (e){
    var aid = e.component.val();
    var target = $('#' + aid).children();
    target.trigger('tap');
};

var apply_select = find_dark(function(node, e){
    $('option', e.target).forEach(function(option, i){
        if (option.selected) {
            this.eq(i).attr('selected', 'selected');
        } else {
            this.eq(i).removeAttr('selected');
        }
    }, node.find('option'));
});

var apply_input = find_dark(function(node, e){
    var checked = e.target.checked;
    node[0].checked = checked;
    if (checked === false) {
        node.removeAttr('checked');
    } else {
        node.attr('checked', 'checked');
    }
    var value = e.target.value;
    node.val(value).attr('value', value);
});

function enable_control(node, e){
    var o = control(node, _.merge({
        disableRequest: true
    }, e.component._config));
    o.responseData = e.component.responseData;
    o.enable();
}

function disable_control(node, e){
    var o = control(node, _.merge({
        disableRequest: true
    }, e.component._config));
    o.responseData = e.component.responseData;
    o.disable();
}

function find_dark(fn){
    return function(e, root){
        var target = e.target.id;
        if (!target) {
            return;
        }
        target = darkdom.getDarkByCustomId(target);
        if (target[0] 
                && !target[0]._ckDisablePageForward) {
            fn(target, e);
            root.updateDarkDOM({
                ignoreRender: true
            });
        }
    };
}

function find_top_dark(fn){
    return function(e){
        var target = e.target.id;
        if (target) {
            target = darkdom.getDarkByCustomId(target);
        } else {
            target = darkdom.getDarkById(e.target.parentNode.id);
        }
        if (!target[0]) {
            return;
        }
        target[0]._ckDisablePageForward = true;
        fn(target, e);
        if (target[0].isDarkSource) {
            var actionbar = $(e.target).closest('.ck-top-actions');
            darkdom.getDarkById(actionbar[0].id).updateDarkSource();
        } else {
            target.updateDarkDOM();
        }
    };
}

return exports;

});

/* @source cardkit/oldspec/common/item.js */;


define("cardkit/oldspec/common/item", [
  "cardkit/helper"
], function(helper){

var source_states = {
    source: helper.readSource
};

return {
    title: function(guard){
        guard.watch('.ckd-title');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-title-link-extern') 
                    && (node.attr('target') || '_blank');
            },
            isAlone: function(node){
                return node.hasClass('ckd-title-link-alone');
            }
        });
    },
    titleLink: function(guard){
        guard.watch('.ckd-title-link');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-title-link-extern') 
                    && (node.attr('target') || '_blank');
            },
            isAlone: function(node){
                return node.hasClass('ckd-title-link-alone');
            }
        });
    },
    titlePrefix: function(guard){
        guard.watch('.ckd-title-prefix');
        guard.state(source_states);
    },
    titleSuffix: function(guard){
        guard.watch('.ckd-title-suffix');
        guard.state(source_states);
    },
    titleTag: function(guard){
        guard.watch('.ckd-title-tag');
        guard.state(source_states);
    },
    icon: function(guard){
        guard.watch('.ckd-icon');
        guard.state(source_states);
        guard.state({
            imgUrl: 'src'
        });
    },
    info: function(guard){
        guard.watch('.ckd-info');
        guard.state(source_states);
    },
    opt: function(guard){
        guard.watch('.ckd-opt');
        guard.state(source_states);
    },
    desc: function(guard){
        guard.watch('.ckd-desc, .ckd-subtitle');
        guard.state(source_states);
    },
    content: function(guard){
        guard.watch('.ckd-content');
        guard.state(source_states);
    },
    meta: function(guard){
        guard.watch('.ckd-meta');
        guard.state(source_states);
    },
    author: function(guard){
        guard.watch('.ckd-author');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-author-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    authorLink: function(guard){
        guard.watch('.ckd-author-link');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-author-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    authorPrefix: function(guard){
        guard.watch('.ckd-author-prefix');
        guard.state(source_states);
    },
    authorSuffix: function(guard){
        guard.watch('.ckd-author-suffix');
        guard.state(source_states);
    },
    avatar: function(guard){
        guard.watch('.ckd-avatar');
        guard.state(source_states);
        guard.state({
            imgUrl: 'src'
        });
    },
    authorInfo: function(guard){
        guard.watch('.ckd-author-info');
        guard.state(source_states);
    },
    authorDesc: function(guard){
        guard.watch('.ckd-author-desc');
        guard.state(source_states);
    },
    authorMeta: function(guard){
        guard.watch('.ckd-author-meta');
        guard.state(source_states);
    }
};

});


/* @source cardkit/oldspec/common/scaffold.js */;


define("cardkit/oldspec/common/scaffold", [
  "cardkit/helper"
], function(helper){

var source_states = {
    source: helper.readSource
};

return {
    hd: function(guard){
        guard.watch('.ckd-hd');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-hd-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    hdLink: function(guard){
        guard.watch('.ckd-hd-link:not(.ckd-hd)');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-hd-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    hdOpt: function(guard){
        guard.watch('.ckd-hdopt');
        guard.state(source_states);
    },
    ft: function(guard){
        guard.watch('.ckd-ft');
    },
    blank: function(guard){
        guard.watch('.ckd-blank');
    }
};

});


/* @source cardkit/spec/common/source_item.js */;


define("cardkit/spec/common/source_item", [
  "cardkit/oldspec/common/item"
], function(__oz0, require){

    return require("cardkit/oldspec/common/item");

});


/* @source cardkit/spec/common/item.js */;


define("cardkit/spec/common/item", [], function(){

return {
    title: function(guard){
        guard.watch('ck-part[type="title"]');
        guard.state({
            link: 'href',
            linkTarget: 'target',
            isAlone: 'alone-mode'
        });
    },
    titleLink: function(guard){
        guard.watch('ck-part[type="titleLink"]');
        guard.state({
            link: 'href',
            linkTarget: 'target',
            isAlone: 'alone-mode'
        });
    },
    titlePrefix: 'ck-part[type="titlePrefix"]',
    titleSuffix: 'ck-part[type="titleSuffix"]',
    titleTag: 'ck-part[type="titleTag"]',
    icon: function(guard){
        guard.watch('ck-part[type="icon"]');
        guard.state({
            imgUrl: 'src'
        });
    },
    info: 'ck-part[type="info"]',
    opt: function(guard){
        guard.watch('ck-part[type="opt"]');
    },
    desc: 'ck-part[type="desc"]',
    content: 'ck-part[type="content"]',
    meta: 'ck-part[type="meta"]',
    author: function(guard){
        guard.watch('ck-part[type="author"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    authorLink: function(guard){
        guard.watch('ck-part[type="authorLink"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    authorPrefix: 'ck-part[type="authorPrefix"]',
    authorSuffix: 'ck-part[type="authorSuffix"]',
    avatar: function(guard){
        guard.watch('ck-part[type="avatar"]');
        guard.state({
            imgUrl: 'src'
        });
    },
    authorInfo: 'ck-part[type="authorInfo"]',
    authorDesc: 'ck-part[type="authorDesc"]',
    authorMeta: 'ck-part[type="authorMeta"]'
};

});


/* @source cardkit/spec/common/source_scaffold.js */;


define("cardkit/spec/common/source_scaffold", [
  "cardkit/oldspec/common/scaffold"
], function(__oz0, require){

    return require("cardkit/oldspec/common/scaffold");

});


/* @source cardkit/spec/common/scaffold.js */;


define("cardkit/spec/common/scaffold", [], function(){

return {
    hd: function(guard){
        guard.watch('ck-part[type="hd"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    hdLink: function(guard){
        guard.watch('ck-part[type="hdLink"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    hdOpt: function(guard){
        guard.watch('ck-part[type="hdOpt"]');
    },
    ft: function(guard){
        guard.watch('ck-part[type="ft"]');
    },
    blank: function(guard){
        guard.watch('ck-part[type="blank"]');
    }
};

});


/* @source cardkit/spec/list.js */;


define("cardkit/spec/list", [
  "dollar",
  "cardkit/helper",
  "cardkit/spec/common/scaffold",
  "cardkit/spec/common/source_scaffold",
  "cardkit/spec/common/item",
  "cardkit/spec/common/source_item"
], function($, helper, scaffold_specs, source_scaffold_specs, 
    item_specs, source_item_specs){ 

var SEL = 'ck-card[type="list"]';

var source_item_states = {
    link: 'href',
    linkTarget: function(node){
        return node.hasClass('ckd-title-link-extern') 
            && (node.attr('target') || '_blank');
    },
    isAlone: function(node){
        return node.hasClass('ckd-title-link-alone');
    },
    customClass: helper.readClass
};

function source_item_spec(source){
    source.watch('.ckd-item');
    source.state(source_item_states);
    source.component(source_item_specs);
}

function init_list(guard){
    guard.state({
        subtype: 'subtype',
        blankText: 'blank-text',
        limit: 'limit', 
        col: 'col', 
        paperStyle: 'paper-style',
        plainStyle: 'plain-style',
        plainHdStyle: 'plain-hd-style',
        customClass: 'custom-class'
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('ck-part[type="item"]');
        guard.state({
            link: 'href',
            linkTarget: 'target',
            isAlone: 'alone-mode',
            customClass: 'custom-class'
        });
        guard.component(item_specs);
        guard.source()
            .state(source_item_states)
            .component(source_item_specs);
    });
    guard.source()
        .component(source_scaffold_specs)
        .component('item', source_item_spec);
}

function exports(guard, parent){
    guard.watch($(SEL, parent));
    init_list(guard);
}

exports.sourceItemStates = source_item_states;
exports.sourceItemSpec = source_item_spec;
exports.initList = init_list;

return exports;

});


/* @source cardkit/oldspec/list.js */;


define("cardkit/oldspec/list", [
  "dollar",
  "cardkit/helper",
  "cardkit/spec/list",
  "cardkit/oldspec/common/scaffold",
  "cardkit/oldspec/common/item"
], function($, helper, list_spec, scaffold_specs, item_specs){ 

var source_states = {
        source: helper.readSource
    },
    source_item_states = list_spec.sourceItemStates,
    source_item_spec = list_spec.sourceItemSpec,
    SEL = '.ckd-list-card',
    SEL_OLD = '.ck-list-unit'; // @deprecated

function init_list(guard){
    guard.state({
        subtype: 'data-style',
        blankText: 'data-cfg-blank',
        limit: 'data-cfg-limit', 
        col: 'data-cfg-col', 
        paperStyle: 'data-cfg-paper',
        plainStyle: 'data-cfg-plain',
        plainHdStyle: 'data-cfg-plainhd',
        customClass: helper.readClass
    });
    guard.state(source_states);
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('.ckd-item');
        guard.state(source_states);
        guard.state(source_item_states);
        guard.component(item_specs);
        guard.source().component(item_specs);
    });
    guard.source()
        .component(scaffold_specs)
        .component('item', source_item_spec);
}

function exports(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    init_list(guard);
}

exports.initList = init_list;

return exports;

});


/* @source cardkit/oldspec/box.js */;


define("cardkit/oldspec/box", [
  "dollar",
  "cardkit/helper",
  "cardkit/oldspec/common/scaffold"
], function($, helper, scaffold_specs){ 

var source_states = {
        source: helper.readSource
    },
    SEL = '.ckd-box-card',
    SEL_OLD = '.ck-box-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    guard.state({
        subtype: 'data-style',
        paperStyle: 'data-cfg-paper',
        plainStyle: 'data-cfg-plain',
        plainHdStyle: 'data-cfg-plainhd',
        customClass: helper.readClass
    });
    guard.state(source_states);
    guard.component(scaffold_specs);
    guard.component({
        content: function(guard){
            guard.watch('.ckd-content');
            guard.state(source_states);
        },
        collect: function(guard){
            guard.watch('.ckd-collect');
            guard.state(source_states);
        }
    });
    guard.source()
        .component(scaffold_specs)
        .component({
            content: '.ckd-content',
            collect: '.ckd-collect'
        });
};

});

/* @source cardkit/spec/form.js */;


define("cardkit/spec/form", [
  "dollar",
  "cardkit/helper",
  "cardkit/spec/common/scaffold",
  "cardkit/spec/common/source_scaffold"
], function($, helper, scaffold_specs, source_scaffold_specs){ 

var SEL = 'ck-card[type="form"]';

function exports(guard, parent){
    guard.watch($(SEL, parent));
    guard.state({
        subtype: 'subtype',
        blankText: 'blank-text',
        plainHdStyle: 'plain-hd-style',
        customClass: 'custom-class'
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('ck-part[type="item"]');
        guard.component({
            title: 'ck-part[type="title"]',
            content: 'ck-part[type="content"]'
        });
        helper.applyInputEvents(guard);
        guard.source().component({
            title: '.ckd-title',
            content: '.ckd-content'
        });
    });
    guard.source()
        .component(source_scaffold_specs)
        .component('item', exports.sourceItemSpec);
}

exports.sourceItemSpec = function(guard){
    guard.watch('.ckd-item');
    guard.component({
        title: '.ckd-title',
        content: '.ckd-content'
    });
};

return exports;

});


/* @source cardkit/oldspec/form.js */;


define("cardkit/oldspec/form", [
  "dollar",
  "cardkit/helper",
  "cardkit/spec/form",
  "cardkit/oldspec/common/scaffold"
], function($, helper, form_spec, scaffold_specs){ 

var source_states = {
        source: helper.readSource
    },
    SEL = '.ckd-form-card',
    SEL_OLD = '.ck-form-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    guard.state({
        subtype: 'data-style',
        blankText: 'data-cfg-blank',
        plainHdStyle: 'data-cfg-plainhd',
        customClass: helper.readClass
    });
    guard.state(source_states);
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('.ckd-item');
        guard.component({
            title: function(guard){
                guard.watch('.ckd-title');
                guard.state(source_states);
            },
            content: function(guard){
                guard.watch('.ckd-content');
                guard.state(source_states);
            }
        });
        helper.applyInputEvents(guard);
        guard.source().component({
            title: '.ckd-title',
            content: '.ckd-content'
        });
    });
    guard.source()
        .component(scaffold_specs)
        .component('item', form_spec.sourceItemSpec);
};

});


/* @source cardkit/oldspec/mini.js */;


define("cardkit/oldspec/mini", [
  "dollar",
  "cardkit/oldspec/list"
], function($, list_spec){ 

var SEL = '.ckd-mini-card',
    SEL_OLD = '.ck-mini-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    list_spec.initList(guard);
};

});


/* @source cardkit/spec/mini.js */;


define("cardkit/spec/mini", [
  "dollar",
  "cardkit/spec/list"
], function($, list_spec){ 

var SEL = 'ck-card[type="mini"]';

return function(guard, parent){
    guard.watch($(SEL, parent));
    list_spec.initList(guard);
};

});


/* @source cardkit/spec/box.js */;


define("cardkit/spec/box", [
  "dollar",
  "cardkit/spec/common/scaffold",
  "cardkit/spec/common/source_scaffold"
], function($, scaffold_specs, source_scaffold_specs){ 

var SEL = 'ck-card[type="box"]';

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.state({
        subtype: 'subtype',
        paperStyle: 'paper-style',
        plainStyle: 'plain-style',
        plainHdStyle: 'plain-hd-style',
        customClass: 'custom-class'
    });
    guard.component(scaffold_specs);
    guard.component({
        content: 'ck-part[type="content"]',
        collect: 'ck-part[type="collect"]'
    });
    guard.source()
        .component(source_scaffold_specs)
        .component({
            content: '.ckd-content',
            collect: '.ckd-collect'
        });
};

});


/* @source cardkit/spec/page.js */;


define("cardkit/spec/page", [
  "dollar",
  "cardkit/helper",
  "cardkit/spec/box",
  "cardkit/spec/list",
  "cardkit/spec/mini",
  "cardkit/spec/form"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, require){ 

var $ = require("dollar"),
    helper = require("cardkit/helper"),
    UNMOUNT_FLAG = '.unmount-page';

var specs = {
    title: 'ck-part[type="title"]',
    actionbar: actionbar_spec,
    nav: nav_spec,
    banner: banner_spec,
    footer: 'ck-part[type="footer"]',
    blank: 'ck-part[type="blank"]',
    box: require("cardkit/spec/box"),
    list: require("cardkit/spec/list"),
    mini: require("cardkit/spec/mini"),
    form: require("cardkit/spec/form"),
};

function nav_spec(guard){
    guard.watch('ck-part[type="nav"]');
    guard.state({
        link: 'href'
    });
}

function banner_spec(guard){
    guard.watch('ck-part[type="banner"]');
    guard.state({
        plainStyle: 'plain-style'
    });
}

function actionbar_spec(guard){
    guard.watch('ck-part[type="actionbar"]');
    guard.state({
        limit: 'limit'
    });
    guard.component('action', action_spec);
    guard.source().component('action', source_action_spec);
    helper.applyActionEvents(guard);
}

function action_spec(guard){
    guard.watch('[action-layout]');
    guard.state({
        label: helper.readLabel,
        forceOverflow: function(node){
            return 'overflow' === 
                node.attr('action-layout');
        }
    });
    source_action_attr(guard.source());
}

function source_action_spec(source){
    source.watch('.ckd-item, .ckd-overflow-item');
    source_action_attr(source);
}

function source_action_attr(source){
    if (!source) {
        return;
    }
    source.state({
        label: helper.readLabel,
        forceOverflow: function(node){
            return node.hasClass('ckd-overflow-item');
        }
    });
}

function exports(guard, parent){
    guard.watch($(exports.SELECTOR + UNMOUNT_FLAG, parent));
    guard.state({
        blankText: 'blank-text',
        deck: 'deck',
        isPageActive: 'active-page',
        isDeckActive: 'active-deck',
        currentDeck: 'current-deck',
        fixedMinHeight: 'fixed-minheight',
        cardId: 'id'
    });
    guard.component(specs);
    helper.applyStateEvents(guard);
}

exports.SELECTOR = 'ck-card[type="page"]';

exports.initOldStyleActionState = source_action_attr;

return exports;

});


/* @source cardkit/oldspec/page.js */;


define("cardkit/oldspec/page", [
  "dollar",
  "cardkit/spec/page",
  "cardkit/helper",
  "cardkit/oldspec/box",
  "cardkit/oldspec/list",
  "cardkit/oldspec/mini",
  "cardkit/oldspec/form"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, require){ 

var $ = require("dollar"),
    newspec = require("cardkit/spec/page"),
    helper = require("cardkit/helper"),
    action_attr = newspec.initOldStyleActionState,
    UNMOUNT_FLAG = '.unmount-page';

var specs = {
    title: title_spec,
    actionbar: actionbar_spec,
    nav: nav_spec,
    banner: banner_spec,
    footer: footer_spec,
    blank: blank_spec,
    box: require("cardkit/oldspec/box"),
    list: require("cardkit/oldspec/list"),
    mini: require("cardkit/oldspec/mini"),
    form: require("cardkit/oldspec/form"),
};

function title_spec(guard){
    guard.watch('.ckd-page-title');
    guard.state('source', helper.readSource);
}

function blank_spec(guard){
    guard.watch('.ckd-page-blank');
    guard.state('source', helper.readSource);
}

function nav_spec(guard){
    guard.watch('.ckd-page-nav');
    guard.state({
        link: 'href',
        source: helper.readSource 
    });
}

function banner_spec(guard){
    guard.watch('.ckd-page-banner');
    guard.watch('.ck-banner-unit'); // @deprecated
    guard.state({
        plainStyle: 'data-cfg-plain',
        source: helper.readSource 
    });
}

function actionbar_spec(guard){
    guard.watch('.ckd-page-actions');
    guard.state({
        limit: 'data-cfg-limit',
        source: helper.readSource 
    });
    guard.component('action', action_spec);
    guard.source().component('action', action_spec);
    helper.applyActionEvents(guard);
}

function footer_spec(guard){
    guard.watch('.ckd-page-footer');
    guard.state('source', helper.readSource);
}

function action_spec(guard){
    guard.watch('.ckd-item, .ckd-overflow-item');
    guard.state('source', helper.readSource);
    action_attr(guard);
    action_attr(guard.source());
}

function exports(guard, parent){
    guard.watch($(exports.SELECTOR + UNMOUNT_FLAG, parent));
    guard.watch($(exports.SELECTOR_OLD + UNMOUNT_FLAG, parent));
    guard.state({
        blankText: 'data-cfg-blank',
        deck: 'data-cfg-deck',
        isPageActive: 'data-active-page',
        isDeckActive: 'data-active-deck',
        currentDeck: 'data-current-deck',
        fixedMinHeight: 'data-fixed-minheight',
        cardId: 'id'
    });
    guard.component(specs);
    helper.applyStateEvents(guard);
}

exports.SELECTOR = '.ckd-page-card';
exports.SELECTOR_OLD = '.ck-card'; // @deprecated

return exports;

});


/* @source cardkit/oldspec.js */;


define("cardkit/oldspec", [
  "cardkit/oldspec/page",
  "cardkit/oldspec/box",
  "cardkit/oldspec/list"
], function(__oz0, __oz1, __oz2, require){

    return {
        page: [require("cardkit/oldspec/page")],
        box: [require("cardkit/oldspec/box")],
        list: [require("cardkit/oldspec/list")],
    };

});


/* @source cardkit/tpl/scaffold/ft.js */;

define("cardkit/tpl/scaffold/ft", [], function(){

    return {"template":"<footer>{%= content %}</footer>\n"}; 

});
/* @source cardkit/tpl/scaffold/hd_opt.js */;

define("cardkit/tpl/scaffold/hd_opt", [], function(){

    return {"template":"<span class=\"ck-hdopt\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/scaffold/hd.js */;

define("cardkit/tpl/scaffold/hd", [], function(){

    return {"template":"<span class=\"ck-hd {%= (hdLink && 'clickable' || '') %}\">\n    {% if (hdLink) { %}\n    <a href=\"{%= hdLink %}\" \n        target=\"{%= (hdLinkTarget || '_self') %}\" \n        class=\"ck-link-mask ck-link\"></a>\n    {% } %}\n    <span>{%= content %}</span>\n</span>\n"}; 

});
/* @source cardkit/card/common/scaffold.js */;


define("cardkit/card/common/scaffold", [
  "darkdom",
  "mo/template/micro",
  "cardkit/helper",
  "cardkit/tpl/scaffold/hd",
  "cardkit/tpl/scaffold/hd_opt",
  "cardkit/tpl/scaffold/ft"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
    render_hd = convert(require("cardkit/tpl/scaffold/hd").template),
    render_hdopt = convert(require("cardkit/tpl/scaffold/hd_opt").template),
    render_ft = convert(require("cardkit/tpl/scaffold/ft").template);

var exports = {

    hd: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                var hdlink_data = data.context.componentData.hdLink;
                var hd_link = helper.readState(hdlink_data, 'link');
                data.hdLink = hd_link
                    || data.state.link;
                data.hdLinkTarget = hd_link 
                    ? helper.readState(hdlink_data, 'linkTarget')
                    : data.state.linkTarget;
                return render_hd(data);
            }
        });
    },

    hdLink: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return data.state.link;
            }
        });
    },

    hdOpt: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_hdopt
        });
    },

    ft: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_ft
        });
    },

    blank: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return '<div>' + data.content + '</div>';
            }
        });
    }

};

return exports;

});


/* @source cardkit/tpl/item/author_meta.js */;

define("cardkit/tpl/item/author_meta", [], function(){

    return {"template":"<span class=\"ck-author-meta\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/author_info.js */;

define("cardkit/tpl/item/author_info", [], function(){

    return {"template":"<span class=\"ck-author-info\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/author_desc.js */;

define("cardkit/tpl/item/author_desc", [], function(){

    return {"template":"<span class=\"ck-author-desc\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/avatar.js */;

define("cardkit/tpl/item/avatar", [], function(){

    return {"template":"{% if (state.imgUrl) { %}\n    {% if (context.authorLink) { %}\n    <a href=\"{%= context.authorLink %}\" \n            target=\"{%= (context.authorLinkTarget || '_self') %}\" \n            class=\"ck-avatar ck-link\">\n        <img src=\"{%= state.imgUrl %}\"/>\n    </a>\n    {% } else { %}\n    <span class=\"ck-avatar\">\n        <img src=\"{%= state.imgUrl %}\"/>\n    </span>\n    {% } %}\n{% } %}\n"}; 

});
/* @source cardkit/tpl/item/author_suffix.js */;

define("cardkit/tpl/item/author_suffix", [], function(){

    return {"template":"<span class=\"ck-author-suffix\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/author_prefix.js */;

define("cardkit/tpl/item/author_prefix", [], function(){

    return {"template":"<span class=\"ck-author-prefix\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/author.js */;

define("cardkit/tpl/item/author", [], function(){

    return {"template":"{% if (context.authorLink) { %}\n<a href=\"{%= context.authorLink %}\" \n    target=\"{%= (context.authorLinkTarget || '_self') %}\" \n    class=\"ck-author ck-link\">{%= content %}</a>\n{% } else { %}\n<span class=\"ck-author\">{%= content %}</span>\n{% } %}\n"}; 

});
/* @source cardkit/tpl/item/meta.js */;

define("cardkit/tpl/item/meta", [], function(){

    return {"template":"<span class=\"ck-meta\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/content.js */;

define("cardkit/tpl/item/content", [], function(){

    return {"template":"<span class=\"ck-content\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/opt.js */;

define("cardkit/tpl/item/opt", [], function(){

    return {"template":"<span class=\"ck-opt\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/info.js */;

define("cardkit/tpl/item/info", [], function(){

    return {"template":"<span class=\"ck-info\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/desc.js */;

define("cardkit/tpl/item/desc", [], function(){

    return {"template":"<span class=\"ck-desc\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/icon.js */;

define("cardkit/tpl/item/icon", [], function(){

    return {"template":"{% if (state.imgUrl) { %}\n    {% if (context.isItemLinkAlone) { %}\n    <a href=\"{%= context.itemLink %}\" \n            target=\"{%= (context.itemLinkTarget || '_self') %}\" \n            class=\"ck-icon ck-link\">\n        <img src=\"{%= state.imgUrl %}\"/>\n    </a>\n    {% } else { %}\n    <span class=\"ck-icon\">\n        <img src=\"{%= state.imgUrl %}\"/>\n    </span>\n    {% } %}\n{% } %}\n"}; 

});
/* @source cardkit/tpl/item/title_tag.js */;

define("cardkit/tpl/item/title_tag", [], function(){

    return {"template":"<span class=\"ck-tag\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/title_suffix.js */;

define("cardkit/tpl/item/title_suffix", [], function(){

    return {"template":"<span class=\"ck-title-suffix\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/title_prefix.js */;

define("cardkit/tpl/item/title_prefix", [], function(){

    return {"template":"<span class=\"ck-title-prefix\">{%= content %}</span>\n"}; 

});
/* @source cardkit/tpl/item/title.js */;

define("cardkit/tpl/item/title", [], function(){

    return {"template":"{% if (context.isItemLinkAlone) { %}\n<a href=\"{%= context.itemLink %}\" \n    class=\"ck-link\"\n    target=\"{%= (context.itemLinkTarget || '_self') %}\">{%= content %}</a>\n{% } else { %}\n<span class=\"ck-title\">{%= content %}</span>\n{% } %}\n\n"}; 

});
/* @source cardkit/tpl/item.js */;

define("cardkit/tpl/item", [], function(){

    return {"template":"<div class=\"ck-item {%= (itemLink && 'clickable' || '') %}  {%= state.customClass %}\" \n        style=\"width:{%= (context.state.col ? Math.floor(1000/context.state.col)/10 + '%' : '') %};\">\n\n    <div class=\"ck-initem\">\n\n        {% if (itemLink && !isItemLinkAlone) { %}\n        <a href=\"{%= itemLink %}\" \n            target=\"{%= (itemLinkTarget || '_self') %}\"\n            class=\"ck-link-mask ck-link\"></a>\n        {% } %}\n\n        <div class=\"ck-title-box\">\n\n            {%= component.opt.join('') %}\n            {%= component.icon %}\n\n            <div class=\"ck-title-set\">\n\n                {% if (itemContent) { %}\n                <div class=\"ck-title-line\">\n                    {%= component.titlePrefix.join('') %}\n                    {%= itemContent %}\n                    {%= component.titleSuffix.join('') %}\n                    {%= component.titleTag.join('') %}\n                </div>\n                {% } %}\n\n                {% if (component.info.length) { %}\n                <div class=\"ck-info-wrap\">\n                    {%= component.info.join('') %}\n                </div>\n                {% } %}\n\n                {% if (component.desc.length) { %}\n                <div class=\"ck-desc-wrap\">\n                    {%= component.desc.join('') %}\n                </div>\n                {% } %}\n\n            </div>\n\n            {% if (component.content.length) { %}\n            <div class=\"ck-content-wrap\">\n                {%= component.content.join('') %}\n            </div>\n            {% } %}\n\n            {% if (component.meta.length) { %}\n            <div class=\"ck-meta-wrap\">\n                {%= component.meta.join('') %}\n            </div>\n            {% } %}\n\n        </div>\n\n        {% if (component.author || component.authorDesc.length || component.authorMeta.length) { %}\n        <div class=\"ck-author-box\">\n\n            {%= component.avatar %}\n\n            <div class=\"ck-author-set\">\n\n                <div class=\"ck-author-line\">\n                    {%= component.authorPrefix.join('') %}\n                    {%= component.author %}\n                    {%= component.authorSuffix.join('') %}\n                </div>\n\n                {% if (component.authorInfo.length) { %}\n                <div class=\"ck-author-info-wrap\">\n                    {%= component.authorInfo.join('') %}\n                </div>\n                {% } %}\n\n                {% if (component.authorDesc.length) { %}\n                <div class=\"ck-author-desc-wrap\">\n                    {%= component.authorDesc.join('') %}\n                </div>\n                {% } %}\n\n            </div>\n\n            {% if (component.authorMeta.length) { %}\n            <div class=\"ck-author-meta-wrap\">\n                {%= component.authorMeta.join('') %}\n            </div>\n            {% } %}\n\n        </div>\n        {% } %}\n\n    </div>\n\n</div>\n\n"}; 

});
/* @source cardkit/card/item.js */;


define("cardkit/card/item", [
  "darkdom",
  "mo/lang/mix",
  "mo/template/micro",
  "cardkit/helper",
  "cardkit/tpl/item",
  "cardkit/tpl/item/title",
  "cardkit/tpl/item/title_prefix",
  "cardkit/tpl/item/title_suffix",
  "cardkit/tpl/item/title_tag",
  "cardkit/tpl/item/icon",
  "cardkit/tpl/item/desc",
  "cardkit/tpl/item/info",
  "cardkit/tpl/item/opt",
  "cardkit/tpl/item/content",
  "cardkit/tpl/item/meta",
  "cardkit/tpl/item/author",
  "cardkit/tpl/item/author_prefix",
  "cardkit/tpl/item/author_suffix",
  "cardkit/tpl/item/avatar",
  "cardkit/tpl/item/author_desc",
  "cardkit/tpl/item/author_info",
  "cardkit/tpl/item/author_meta"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, __oz7, __oz8, __oz9, __oz10, __oz11, __oz12, __oz13, __oz14, __oz15, __oz16, __oz17, __oz18, __oz19, __oz20, __oz21, require){

var darkdom = require("darkdom"),
    _ = require("mo/lang/mix"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
    render_item = convert(require("cardkit/tpl/item").template),
    render_title = convert(require("cardkit/tpl/item/title").template),
    render_title_prefix = convert(require("cardkit/tpl/item/title_prefix").template),
    render_title_suffix = convert(require("cardkit/tpl/item/title_suffix").template),
    render_title_tag = convert(require("cardkit/tpl/item/title_tag").template),
    render_icon = convert(require("cardkit/tpl/item/icon").template),
    render_desc = convert(require("cardkit/tpl/item/desc").template),
    render_info = convert(require("cardkit/tpl/item/info").template),
    render_opt = convert(require("cardkit/tpl/item/opt").template),
    render_content = convert(require("cardkit/tpl/item/content").template),
    render_meta = convert(require("cardkit/tpl/item/meta").template),
    render_author = convert(require("cardkit/tpl/item/author").template),
    render_author_prefix = convert(require("cardkit/tpl/item/author_prefix").template),
    render_author_suffix = convert(require("cardkit/tpl/item/author_suffix").template),
    render_avatar = convert(require("cardkit/tpl/item/avatar").template),
    render_author_desc = convert(require("cardkit/tpl/item/author_desc").template),
    render_author_info = convert(require("cardkit/tpl/item/author_info").template),
    render_author_meta = convert(require("cardkit/tpl/item/author_meta").template);

var exports = {

    title: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_title
        });
    },

    titleLink: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return data.state.link;
            }
        });
    },

    titlePrefix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_title_prefix
        });
    },

    titleSuffix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_title_suffix
        });
    },

    titleTag: function(){
        return darkdom({
            enableSource: true,
            render: render_title_tag
        });
    },

    icon: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_icon
        });
    },

    desc: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_desc
        });
    },

    info: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_info
        });
    },

    opt: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_opt
        });
    },

    content: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_content
        });
    },

    meta: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_meta
        });
    },

    author: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_author
        });
    },

    authorLink: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return data.state.link;
            }
        });
    },

    authorPrefix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_prefix
        });
    },

    authorSuffix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_suffix
        });
    },

    avatar: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_avatar
        });
    },

    authorDesc: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_desc
        });
    },

    authorInfo: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_info
        });
    },

    authorMeta: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_meta
        });
    },

    item: function(){
        var item = darkdom({
            enableSource: true,
            render: function(data){
                var read_state = helper.readState;
                var state = data.state;
                var com = data.component;
                var comdata = data.componentData;
                var link_data = com.titleLink 
                    ? comdata.titleLink : comdata.title;
                data.itemLinkTarget = read_state(link_data, 'linkTarget')
                    || state.linkTarget;
                data.isItemLinkAlone = read_state(link_data, 'isAlone')
                    || state.isAlone;
                data.itemLink = com.titleLink
                    || read_state(comdata.title, 'link')
                    || state.link;
                data.itemContent = com.title || data.content;
                var author_data = com.authorLink 
                    ? comdata.authorLink : comdata.author;
                data.authorLinkTarget = read_state(author_data, 'linkTarget');
                data.authorLink = com.authorLink
                    || read_state(comdata.author, 'link');
                return render_item(data);
            }
        });
        var parts = _.copy(exports);
        delete parts.item;
        item.contain(parts);
        return item;
    }

};

return exports;

});

/* @source cardkit/tpl/list.js */;

define("cardkit/tpl/list", [], function(){

    return {"template":"<div class=\"ck-list-card {%= (state.blankText === 'false' ? 'no-blank' : '') %} {%= state.customClass %}\"\n        data-style=\"{%= state.subtype %}\"\n        {%= state.col ? 'data-cfg-col=\"' + state.col + '\" ' : '' %}\n        {%= state.paperStyle ? 'data-cfg-paper=\"true\" ' : '' %}\n        {%= state.plainStyle ? 'data-cfg-plain=\"true\" ' : '' %}\n        {%= state.plainHdStyle ? 'data-cfg-plainhd=\"true\" ' : '' %}>\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n        \n        <div class=\"ck-list-wrap\">\n\n            {% if (component.item.length) { %}\n\n                <div class=\"ck-list\">\n                {% component.item.forEach(function(item, i){ %}\n\n                    {% if (i && (i % state.col === 0)) { %}\n                    </div><div class=\"ck-list\">\n                    {% } %}\n\n                    {%= item %}\n\n                {% }); %}\n                </div>\n\n            {% } else { %}\n\n                <div class=\"ck-list\">\n                    <div class=\"ck-item blank\">\n                        <div class=\"ck-initem\">\n                        {% if (component.blank) { %}\n                            {%= component.blank %}\n                        {% } else { %}\n                            {%=(state.blankText || '目前还没有内容')%}\n                        {% } %}\n                        </div>\n                    </div>\n                </div>\n\n            {% } %}\n\n        </div>\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n\n"}; 

});
/* @source cardkit/tpl/scaffold/hdwrap.js */;

define("cardkit/tpl/scaffold/hdwrap", [], function(){

    return {"template":"\n{% if (component.hd) { %}\n<header class=\"ck-hd-wrap\">\n\n    {%= component.hd %}\n\n    {% if (component.hdOpt.length) { %}\n        <div class=\"ck-hdopt-wrap\">\n            {%= component.hdOpt.join('') %}\n        </div>\n    {% } %}\n\n</header>\n{% } %}\n"}; 

});
/* @source cardkit/card/list.js */;


define("cardkit/card/list", [
  "darkdom",
  "mo/template/micro",
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/list",
  "cardkit/card/item",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    render_hdwrap = convert(require("cardkit/tpl/scaffold/hdwrap").template),
    render_list = convert(require("cardkit/tpl/list").template),
    item = require("cardkit/card/item"),
    scaffold_components = require("cardkit/card/common/scaffold");

var exports = {

    item: item.item,

    list: function(){
        var list = darkdom({
            enableSource: true,
            render: function(data){
                var s = data.state;
                data.hasSplitHd = s.plainStyle === 'true' 
                    || s.plainHdStyle === 'true'
                    || s.subtype === 'split';
                data.hdwrap = render_hdwrap(data);
                return render_list(data);
            }
        });
        list.contain(scaffold_components);
        list.contain('item', exports.item);
        return list;
    }

};

return exports;

});


/* @source cardkit/tpl/box.js */;

define("cardkit/tpl/box", [], function(){

    return {"template":"<div class=\"ck-box-card {%= state.customClass %}\"\n        data-style=\"{%= state.subtype %}\"\n        {%= state.paperStyle ? 'data-cfg-paper=\"true\" ' : '' %}\n        {%= state.plainStyle ? 'data-cfg-plain=\"true\" ' : '' %}\n        {%= state.plainHdStyle ? 'data-cfg-plainhd=\"true\" ' : '' %}>\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n\n        {% if (!isBlank) { %}\n            <section>{%= component.collect.join('') || content %}</section>\n        {% } %}\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n"}; 

});
/* @source cardkit/tpl/box/collect.js */;

define("cardkit/tpl/box/collect", [], function(){

    return {"template":"<div class=\"ck-content\">{%= content %}</div>\n"}; 

});
/* @source cardkit/tpl/box/content.js */;

define("cardkit/tpl/box/content", [], function(){

    return {"template":"<div class=\"ck-content\">{%= content %}</div>\n"}; 

});
/* @source cardkit/card/box.js */;


define("cardkit/card/box", [
  "darkdom",
  "mo/template/micro",
  "cardkit/helper",
  "cardkit/tpl/box/content",
  "cardkit/tpl/box/collect",
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/box",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, __oz7, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
    render_content = convert(require("cardkit/tpl/box/content").template),
    render_collect = convert(require("cardkit/tpl/box/collect").template),
    render_hdwrap = convert(require("cardkit/tpl/scaffold/hdwrap").template),
    render_box = convert(require("cardkit/tpl/box").template),
    scaffold_components = require("cardkit/card/common/scaffold");

var exports = {

    content: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_content
        });
    },

    collect: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_collect
        });
    },

    box: function(){
        var box = darkdom({
            enableSource: true,
            render: function(data){
                data.isBlank = !data.component.collect.length 
                    && helper.isBlank(data.content);
                data.hasSplitHd = data.state.plainStyle === 'true'
                    || data.state.plainHdStyle === 'true';
                data.hdwrap = render_hdwrap(data);
                return render_box(data);
            }
        });
        box.contain(scaffold_components);
        box.contain('content', exports.content, {
            content: true
        });
        box.contain('collect', exports.collect);
        return box;
    }

};

return exports;

});


/* @source cardkit/tpl/form.js */;

define("cardkit/tpl/form", [], function(){

    return {"template":"<div class=\"ck-form-card {%= (state.blankText === 'false' ? 'no-blank' : '') %} {%= state.customClass %}\"\n        data-style=\"{%= state.subtype %}\"\n        {%= state.plainHdStyle ? 'data-cfg-plainhd=\"true\" ' : '' %}>\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n\n        {% if (component.item.length) { %}\n            {% component.item.forEach(function(item){ %}\n                {%= item %}\n            {% }); %}\n        {% } else { %}\n            <div class=\"ck-item blank\">\n            {% if (component.blank) { %}\n                {%= component.blank %}\n            {% } else { %}\n                {%=(state.blankText || '目前还没有内容')%}\n            {% } %}\n            </div>\n        {% } %}\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n"}; 

});
/* @source cardkit/tpl/form/content.js */;

define("cardkit/tpl/form/content", [], function(){

    return {"template":"<div class=\"ck-content\">{%= content %}</div>\n"}; 

});
/* @source cardkit/tpl/form/title.js */;

define("cardkit/tpl/form/title", [], function(){

    return {"template":"<label class=\"ck-title\">{%= content %}</label>\n"}; 

});
/* @source cardkit/tpl/form/item.js */;

define("cardkit/tpl/form/item", [], function(){

    return {"template":"<div class=\"ck-item\">\n    {%= component.title %}\n    {%= content %}\n</div>\n"}; 

});
/* @source cardkit/card/form.js */;


define("cardkit/card/form", [
  "darkdom",
  "mo/template/micro",
  "cardkit/tpl/form/item",
  "cardkit/tpl/form/title",
  "cardkit/tpl/form/content",
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/form",
  "cardkit/helper",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, __oz7, __oz8, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    render_item = convert(require("cardkit/tpl/form/item").template),
    render_title = convert(require("cardkit/tpl/form/title").template),
    render_content = convert(require("cardkit/tpl/form/content").template),
    render_hdwrap = convert(require("cardkit/tpl/scaffold/hdwrap").template),
    render_form = convert(require("cardkit/tpl/form").template),
    helper = require("cardkit/helper"),
    scaffold_components = require("cardkit/card/common/scaffold");

var exports = {

    title: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_title
        });
    },
    
    content: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_content
        });
    },

    item: function(){
        var component = darkdom({
            enableSource: true,
            render: render_item
        }).contain('content', exports.content, {
            content: true
        }).contain('title', exports.title);
        helper.forwardInputEvents(component);
        return component;
    },

    form: function(){
        var form = darkdom({
            enableSource: true,
            render: function(data){
                data.hasSplitHd = data.state.plainStyle === 'true'
                    || data.state.plainHdStyle === 'true';
                data.hdwrap = render_hdwrap(data);
                return render_form(data);
            }
        });
        form.contain(scaffold_components);
        form.contain('item', exports.item);
        return form;
    }

};

return exports;

});


/* @source cardkit/tpl/mini.js */;

define("cardkit/tpl/mini", [], function(){

    return {"template":"<div class=\"ck-mini-card {%= (state.blankText === 'false' ? 'no-blank' : '') %} {%= state.customClass %}\"\n        data-style=\"{%= state.subtype %}\">\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap {%= (component.item.length > 1 ? 'slide' : '') %}\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n        \n        <div class=\"ck-list-wrap\">\n\n            {% if (component.item.length) { %}\n\n                <div class=\"ck-list\" style=\"width:{%= listWidth %};\">\n                {% component.item.forEach(function(item){ %}\n                    <div class=\"ck-col\" style=\"width:{%= itemWidth %};\">\n                        {%= item %}\n                    </div>\n                {% }); %}\n                </div>\n\n            {% } else { %}\n\n                <div class=\"ck-list\">\n                    <div class=\"ck-item blank\">\n                        <div class=\"ck-initem\">\n                        {% if (component.blank) { %}\n                            {%= component.blank %}\n                        {% } else { %}\n                            {%=(state.blankText || '目前还没有内容')%}\n                        {% } %}\n                        </div>\n                    </div>\n                </div>\n\n            {% } %}\n\n        </div>\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n\n"}; 

});
/* @source cardkit/card/mini.js */;


define("cardkit/card/mini", [
  "darkdom",
  "mo/template/micro",
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/mini",
  "cardkit/card/item",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    render_hdwrap = convert(require("cardkit/tpl/scaffold/hdwrap").template),
    render_mini = convert(require("cardkit/tpl/mini").template),
    item = require("cardkit/card/item"),
    scaffold_components = require("cardkit/card/common/scaffold");

var exports = {

    item: item.item,

    mini: function(){
        var mini = darkdom({
            enableSource: true,
            render: function(data){
                data.hasSplitHd = true;
                data.hdwrap = render_hdwrap(data);
                var l = data.component.item.length;
                data.listWidth = l > 1 ? (l * 100 * 0.94 + '%') : '';
                data.itemWidth = Math.floor(1000/l)/10 + '%';
                return render_mini(data);
            }
        });
        mini.contain(scaffold_components);
        mini.contain('item', exports.item);
        return mini;
    }

};

return exports;

});


/* @source cardkit/tpl/page.js */;

define("cardkit/tpl/page", [], function(){

    return {"template":"\n<div class=\"ck-page-card{%= !hasHeader ? ' no-header' : '' %}{%= !component.banner || componentData.banner.isBlank ? '' : ' with-banner' %}{%= state.isPageActive === 'true' ? ' topbar-enabled' : '' %}\" \n        data-style=\"{%= state.subtype %}\"\n        data-page-active=\"{%= state.isPageActive || 'false' %}\"\n        data-deck-active=\"{%= state.isDeckActive || 'false' %}\"\n        data-deck=\"{%= (state.deck || 'main') %}\"\n        data-curdeck=\"{%= state.currentDeck %}\"\n        data-fixed-minheight=\"{%= (state.fixedMinHeight === 'false' && 'false' || 'true') %}\"\n        data-cardid=\"{%= state.cardId %}\">\n\n    {% if (hasHeader) { %}\n    <div class=\"ck-header\">\n        <div class=\"ck-header-shd\"></div>\n        {%= component.nav %}\n        {%= component.title %}\n        {%= component.actionbar %}\n    </div>\n    {% } %}\n\n    {%= component.banner %}\n\n    <div class=\"ck-article\">\n        {% if (!isBlank) { %}\n            {%= content %}\n        {% } else { %}\n            <div class=\"ck-blank-card\">\n                <article class=\"ck-card-wrap\">\n                    {% if (component.blank) { %}\n                        {%= component.blank %}\n                    {% } else { %}\n                        <div>{%=(state.blankText || '目前还没有内容')%}</div>\n                    {% } %}\n                </article>\n            </div>\n        {% } %}\n    </div>\n\n    {% if (component.footer) { %}\n    <div class=\"ck-footer\">{%= component.footer %}</div>\n    {% } %}\n\n    <a class=\"ck-page-link-mask ck-link\" href=\"#{%= state.cardId %}\"></a>\n\n</div>\n\n"}; 

});
/* @source cardkit/tpl/page/actionbar/action.js */;

define("cardkit/tpl/page/actionbar/action", [], function(){

    return {"template":"\n<span class=\"ck-top-act\">\n    <button type=\"button\" class=\"ck-option\" \n        value=\"{%= id %}\">{%= state.label %}</button>\n    {%= content %}\n</span>\n"}; 

});
/* @source cardkit/tpl/page/actionbar.js */;

define("cardkit/tpl/page/actionbar", [], function(){

    return {"template":"<div class=\"ck-top-actions\">\n\n    {% if (overflowActions.length) { %}\n    <span class=\"ck-top-overflow\"\n            data-title=\"More actions...\">\n        {% overflowActions.forEach(function(action){ %}\n            {%= action %}\n        {% }); %}\n    </span>\n    {% } %}\n\n    {% visibleActions.forEach(function(action){ %}\n        {%= action %}\n    {% }); %}\n\n</div>\n"}; 

});
/* @source cardkit/tpl/page/banner.js */;

define("cardkit/tpl/page/banner", [], function(){

    return {"template":"<div class=\"ck-top-banner\"\n        {%= state.plainStyle ? 'data-cfg-plain=\"true\" ' : '' %}>\n    <div class=\"ck-top-banner-inner\">{%= content %}</div>\n</div>\n"}; 

});
/* @source cardkit/tpl/page/nav.js */;

define("cardkit/tpl/page/nav", [], function(){

    return {"template":"{% if (content) { %}\n<span class=\"ck-top-nav\">{%= content %}</span>\n{% } else { %}\n<a class=\"ck-top-nav ck-link\" href=\"{%= state.link %}\"></a>\n{% } %}\n"}; 

});
/* @source cardkit/tpl/page/title.js */;

define("cardkit/tpl/page/title", [], function(){

    return {"template":"<div class=\"ck-top-title\">{%= content %}</div>\n"}; 

});
/* @source cardkit/card/page.js */;


define("cardkit/card/page", [
  "darkdom",
  "mo/lang/mix",
  "mo/template/micro",
  "cardkit/helper",
  "cardkit/tpl/page/title",
  "cardkit/tpl/page/nav",
  "cardkit/tpl/page/banner",
  "cardkit/tpl/page/actionbar",
  "cardkit/tpl/page/actionbar/action",
  "cardkit/tpl/page",
  "cardkit/card/box",
  "cardkit/card/list",
  "cardkit/card/mini",
  "cardkit/card/form"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, __oz7, __oz8, __oz9, __oz10, __oz11, __oz12, __oz13, require){

var darkdom = require("darkdom"),
    _ = require("mo/lang/mix"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
    render_title = convert(require("cardkit/tpl/page/title").template),
    render_nav = convert(require("cardkit/tpl/page/nav").template),
    render_banner = convert(require("cardkit/tpl/page/banner").template),
    render_actionbar = convert(require("cardkit/tpl/page/actionbar").template),
    render_action = convert(require("cardkit/tpl/page/actionbar/action").template),
    render_page = convert(require("cardkit/tpl/page").template);

var cards = {
    box: require("cardkit/card/box").box,
    list: require("cardkit/card/list").list, 
    mini: require("cardkit/card/mini").mini, 
    form: require("cardkit/card/form").form,
};

var exports = {

    title: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_title
        });
    },

    nav: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_nav
        });
    },

    banner: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                data.isBlank = helper.isBlank(data.content);
                return render_banner(data);
            }
        });
    },

    action: function(){
        return darkdom({
            enableSource: true,
            entireAsContent: true,
            render: render_action
        });
    },

    actionbar: function(){
        var component = darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                var limit = data.state.limit || 1;
                data.visibleActions = [];
                data.overflowActions = [];
                data.componentData.action.forEach(function(action, i){
                    var action_html = data.component.action[i];
                    if (this.length < limit
                            && !action.state.forceOverflow) {
                        this.push(action_html);
                    } else {
                        data.overflowActions.push(action_html);
                    }
                }, data.visibleActions);
                return render_actionbar(data);
            }
        }).contain('action', exports.action);
        helper.forwardActionEvents(component);
        return component;
    },

    blank: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return '<div>' + data.content + '</div>';
            }
        });
    },

    footer: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return '<div>' + data.content + '</div>';
            }
        });
    },

    page: function(){
        var page = darkdom({
            render: function(data){
                var com = data.component;
                data.hasHeader = com.title 
                    || com.nav || com.actionbar;
                data.isBlank = helper.isBlank(data.content);
                return render_page(data);
            } 
        });
        var parts = _.copy(exports);
        delete parts.page;
        page.contain(parts);
        page.contain(cards, { content: true });
        page.response('state:isPageActive', when_page_active);
        page.response('state:isDeckActive', when_deck_active);
        page.response('state:currentDeck', when_deck_change);
        helper.forwardStateEvents(page);
        return page;
    }

};

function when_page_active(changes){
    var root = changes.root;
    if (changes.newValue === 'true') {
        if (root.attr('data-fixed-minheight') !== 'false') {
            root.css('min-height', window.innerHeight * 1.4 + 'px');
        }
        root.attr('data-page-active', true);
        setTimeout(function(){
            root.addClass('topbar-enabled');
            window.scrollTo(0, 0);
        }, 100);
    } else {
        root.attr('data-page-active', false)
            .removeClass('topbar-enabled');
    }
    return false;
}

function when_deck_active(changes){
    var root = changes.root;
    if (changes.newValue === 'true') {
        if (root.attr('data-fixed-minheight') !== 'false') {
            root.css('min-height', window.innerHeight * 1.4 + 'px');
        }
        root.attr('data-deck-active', true);
    } else {
        root.attr('data-deck-active', false);
        setTimeout(function(){
            window.scrollTo(0, 0);
        }, 300);
    }
    return false;
}

function when_deck_change(changes){
    changes.root.attr('data-curdeck', changes.newValue);
    return false;
}

return exports;

});


/* @source cardkit/spec.js */;


define("cardkit/spec", [
  "cardkit/spec/page",
  "cardkit/card/page",
  "cardkit/spec/box",
  "cardkit/card/box",
  "cardkit/spec/list",
  "cardkit/card/list"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, require){

    return {
        page: [require("cardkit/spec/page"), require("cardkit/card/page")],
        box: [require("cardkit/spec/box"), require("cardkit/card/box")],
        list: [require("cardkit/spec/list"), require("cardkit/card/list")],
    };

});

/* @source cardkit.js */;


define('cardkit', [
  "mo/lang",
  "dollar",
  "mo/mainloop",
  "cardkit/spec",
  "cardkit/oldspec",
  "cardkit/ui",
  "cardkit/supports",
  "cardkit/bus"
], function(_, $, mainloop,
    specs, oldspecs, ui, supports, bus){

var DEFAULT_DECK = 'main',
    UNMOUNT_FLAG = 'unmount-page',
    RE_HASH = /#(.+)$/,
    doc = document,
    body = doc.body,
    _components = {},
    _specs = {},
    _guards = {},
    _decks = {},
    _current_deck,
    _page_opening,
    _defaults = {
        appWrapper: null,
        defaultPage: 'ckDefault',
        oldStyle: false,
        hybirdMode: false
    };

var exports = {

    init: function(opt){
        this._config = _.config({}, opt, _defaults);
        this._specs = this._config.oldStyle ? oldspecs : specs;
        this.initSpec();
        this.initView();
    },

    initSpec: function(){
        _.each(specs, function(data, name){
            var spec = this._specs[name][0];
            this.component(name, data[1][name]());
            _specs[name] = spec;
        }, this);
    },

    initView: function(){
        this.wrapper = $(this._config.appWrapper || body);
        if (supports.webview) {
            this.wrapper.addClass('ck-in-webview');
        }
        if (this._config.hybirdMode) {
            this.wrapper.addClass('ck-in-hybird');
        }
        if (!supports.noBugWhenFixed) {
            this.wrapper.addClass('ck-bugfix-fixed');
        }
        bus.on('ready', function(){
            $(window).on('hashchange', function(e){
                e.preventDefault();
                exports.openPage();
            });
        });
        ui.init(this._config);
    },

    component: function(name, component){
        if (component) {
            _components[name] = component;
        } else {
            return _components[name];
        }
    },

    guard: function(name){
        if (!_guards[name]) {
            _guards[name] = this.component(name).createGuard();
        }
        return _guards[name];
    },

    render: function(name, parent){
        var spec = _specs[name];
        var guard = this.guard(name);
        if (spec && guard) {
            spec(guard, parent || this.wrapper);
            guard.mount();
        }
    },

    scrollPageTo: function(pid){
        var target = $('.ck-page-card #' + pid);
        if (target[0]) {
            mainloop.addTween('scrollPage', 
                    window.scrollY, target.offset().top, 400, { 
                easing: 'ease',
                step: function(v){
                    window.scrollTo(0, v);
                },
                callback: function(){
                    mainloop.pause();
                }
            }).run('scrollPage');
        }
    },

    openPageByNode: function(node){
        var spec = this._specs['page'][0];
        var outer_page = node.closest(spec.SELECTOR);
        if (!outer_page[0]) {
            outer_page = node.closest(spec.SELECTOR_OLD);
        }
        if (outer_page[0]) {
            var last_decktop = _decks[_current_deck];
            if (!last_decktop || last_decktop[0] !== outer_page[0]) {
                this.openPage(outer_page);
            }
        }
        return outer_page;
    },

    openPage: function(page){
        if (_page_opening) {
            return false;
        }
        page = this.findPage(page);
        var pid = page[1];
        page = page[0];
        var is_page = this.isPage(page);
        if (pid && page[0] && !is_page) {
            this.openPageByNode(page);
            setTimeout(function(){
                this.scrollPageTo(pid);
            }.bind(this), 400);
            return true;
        }
        var last_decktop = _decks[DEFAULT_DECK];
        var is_init = !last_decktop;
        if (!page[0] || !is_page) {
            if (!is_init) {
                return false;
            }
            location.replace('#' + this._config.defaultPage);
            page = $('#' + this._config.defaultPage);
        }
        window.scrollTo(0, 0);
        if (is_init) {
            last_decktop = $('#' + this._config.defaultPage);
            if (page[0] !== last_decktop[0]) {
                _decks[DEFAULT_DECK] = last_decktop;
                this.openPage(last_decktop);
            }
        }
        _page_opening = true;
        if (!page[0].isMountedDarkDOM) {
            page.addClass(UNMOUNT_FLAG);
            this.render('page');
            page.removeClass(UNMOUNT_FLAG);
        }
        var deck = page.getDarkState('deck') || DEFAULT_DECK,
            decktop = _decks[deck];
        last_decktop = _decks[_current_deck];
        _decks[deck] = page;
        _.each(_decks, notify_deck, deck);
        if (deck !== _current_deck) {
            var is_modal = _current_deck === 'modalview';
            _current_deck = deck;
            if (is_modal) {
                exports.closeModal();
            }
            if (last_decktop 
                    && $.contains(body, last_decktop[0])) {
                blur_page(last_decktop);
            }
        }
        if (decktop 
                && decktop[0] !== page[0] 
                && $.contains(body, decktop[0])) {
            close_page(decktop);
        }
        if (is_init) {
            page.once('pageCard:opened', function(){
                bus.resolve('ready');
            });
        }
        open_page(page);
        focus_page(page);
        _page_opening = false;
        return true;
    },

    resetPage: function(page){
        page = this.findPage(page)[0];
        if (!page[0]) {
            return;
        }
        page.resetDarkDOM();
    },

    updatePage: function(page){
        page = page ? this.findPage(page)[0]
            : this.currentPage()[0];
        page.updateDarkDOM();
    },

    currentPage: function(){
        return _decks[_current_deck] || $();
    },

    findPage: function(page){
        var pid;
        if (!page || typeof page === 'string') {
            var hash = RE_HASH.exec(location.href);
            pid = page 
                || hash && hash[1] 
                || this._config.defaultPage;
            page = $('#' + pid);
        } else {
            page = $(page);
        }
        return [page, pid];
    },

    isPage: function(page){
        var spec = this._specs['page'][0];
        return page.is(spec.SELECTOR)
            || spec.SELECTOR_OLD 
                && page.is(spec.SELECTOR_OLD);
    },

    isLandscape: function() {
        return window.innerWidth / window.innerHeight > 1.1;
    },

    brightDelegate: ui.brightDelegate,
    darkDelegate: ui.darkDelegate,
    ui: ui,
    event: bus

};

_.mix(exports, ui.action);
_.mix(exports, ui.component);

exports.openURL = exports.openLink; // @deprecated

exports.modalCard.event.on('open', function(modal){
    modal.lastDecktop = _decks[_current_deck];
    exports.openPage(modal.pageNode());
}).on('willUpdateContent', function(modal){
    var page = modal.pageNode();
    if (page[0] && page[0].isMountedDarkDOM) {
        exports.resetPage(page);
    }
}).on('close', function(modal){
    if (_current_deck === 'modalview') {
        exports.openPage(modal.lastDecktop);
    }
//}).on('frameOnload', function(modal){
    //exports.render('page', modal._iframeWindow[0].document);
});

function open_page(page){
    if (page.getDarkState('isPageActive') === 'true') {
        return;
    }
    page.trigger('pageCard:willOpen')
        .setDarkState('isPageActive', true, {
            update: true
        })
        .trigger('pageCard:opened');
}

function close_page(page){
    if (page.getDarkState('isPageActive') !== 'true') {
        return;
    }
    page.trigger('pageCard:willClose')
        .setDarkState('isPageActive', false, {
            update: true
        })
        .trigger('pageCard:closed');
}

function focus_page(page){
    if (page.getDarkState('isDeckActive') === 'true') {
        return;
    }
    page.trigger('pageCard:willFocus')
        .setDarkState('isDeckActive', true, {
            update: true
        })
        .trigger('pageCard:focused');
}

function blur_page(page){
    if (page.getDarkState('isDeckActive') !== 'true') {
        return;
    }
    page.trigger('pageCard:willBlur')
        .setDarkState('isDeckActive', false, {
            update: true
        })
        .trigger('pageCard:blured');
}

function notify_deck(page){
    page.setDarkState('currentDeck', this, {
        update: true
    });
}

return exports;

});

/* @source  */;


require.config({
    baseUrl: 'vendor/'
});

define('mo/easing/functions', [], function(){});
define('mo/mainloop', [], function(){});

require(['cardkit'], function(){});

