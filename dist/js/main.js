
/* @source ../lib/oz.js */;

/**
 * OzJS: microkernel for modular javascript 
 * compatible with AMD (Asynchronous Module Definition)
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */ 
(function(){

var window = this,
    _toString = Object.prototype.toString,
    _RE_PLUGIN = /(.*)!(.+)/,
    _RE_DEPS = /\Wrequire\((['"]).+?\1\)/g,
    _RE_SUFFIX = /\.(js|json)$/,
    _RE_RELPATH = /^\.+?\/.+/,
    _RE_DOT = /(^|\/)\.\//g,
    _RE_ALIAS_IN_MID = /^([\w\-]+)\//,
    _builtin_mods = { "require": 1, "exports": 1, "module": 1, "host": 1, "finish": 1 },

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
function define(name, deps, block){
    var is_remote = typeof block === 'string';
    if (!block) {
        if (deps) {
            if (isArray(deps)) {
                block = filesuffix(realname(basename(name)));
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
                deps = seek(block);
            }
        }
    }
    name = name && realname(name);
    var mod = name && _config.mods[name];
    if (!_config.debug && mod && mod.name 
            && (is_remote && mod.loaded == 2 || mod.exports)) {
        return;
    }
    if (is_remote && _config.enable_ozma) {
        deps = null;
    }
    var host = isWindow(this) ? this : window;
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
    if (mod.block && !isFunction(mod.block)) { // json module
        mod.exports = block;
    }
}

/**
 * @public run a code block its dependencies 
 * @param {string[]} [module name] dependencies
 * @param {function}
 */ 
function require(deps, block, _self_mod) {
    if (typeof deps === 'string') {
        if (!block) {
            return (_config.mods[realname(basename(deps, _scope))] 
                || {}).exports;
        }
        deps = [deps];
    } else if (!block) {
        block = deps;
        deps = seek(block);
    }
    var host = isWindow(this) ? this : window;
    if (!_self_mod) {
        _self_mod = { url: _scope && _scope.url };
    }
    var m, remotes = 0, // counter for remote scripts
        list = scan.call(host, deps, _self_mod);  // calculate dependencies, find all required modules
    for (var i = 0, l = list.length; i < l; i++) {
        m = list[i];
        if (m.is_reset) {
            m = _config.mods[m.name];
        }
        if (m.url && m.loaded !== 2) { // remote module
            remotes++;
            m.loaded = 1; // status: loading
            fetch(m, function(){
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
                    require.call(host, deps, block, _self_mod);
                }
            });
        }
    }
    if (!remotes) {
        _self_mod.deps = deps;
        _self_mod.host = host;
        _self_mod.block = block;
        setTimeout(function(){
            tidy(deps, _self_mod);
            list.push(_self_mod);
            exec(list.reverse());
        }, 0);
    }
}

/**
 * @private execute modules in a sequence of dependency
 * @param {object[]} [module object]
 */ 
function exec(list){
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
        deps[mod.block.hiddenDeps ? 'unshift' : 'push']("require", "exports", "module");
        for (var i = 0, l = deps.length; i < l; i++) {
            mid = deps[i];
            switch(mid) {
                case 'require':
                    depObjs.push(require);
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
                        // HACK: no guarantee that this function will be invoked after while() loop termination in Chrome/Safari 
                        setTimeout(function(){
                            // 'mod' equal to 'list[list.length-1]'
                            if (result !== undefined) {
                                mod.exports = result;
                            }
                            if (!wt[tid])
                                return;
                            forEach.call(wt[tid], function(list){
                                this(list);
                            }, exec);
                            delete wt[tid];
                            mod.running = 0;
                        }, 0);
                    });
                    isAsync = 1;
                    break;
                default:
                    depObjs.push((
                        (_resets[mid] || []).pop() 
                        || _config.mods[realname(mid)] 
                        || {}
                    ).exports);
                    break;
            }
        }
        if (!mod.running) {
            // execute module code. arguments: [dep1, dep2, ..., require, exports, module]
            _scope = mod;
            result = mod.block.apply(mod.host, depObjs) || null;
            _scope = false;
            exportObj = moduleObj.exports;
            mod.exports = result !== undefined ? result : exportObj; // use empty exportObj for "finish"
            for (var v in exportObj) {
                if (v) {
                    mod.exports = exportObj;
                }
                break;
            }
        }
        if (isAsync) { // skip, wait for finish() 
            mod.running = 1;
            break;
        }
    }
}

/**
 * @private observer for script loader, prevent duplicate requests
 * @param {object} module object
 * @param {function} callback
 */ 
function fetch(m, cb){
    var url = m.url,
        observers = _scripts[url];
    if (!observers) {
        var mname = m.name, delays = _delays;
        if (m.deps && m.deps.length && delays[mname] !== 1) {
            delays[mname] = [m.deps.length, cb];
            m.deps.forEach(function(dep){
                var d = _config.mods[realname(dep)];
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
                + (_config.enableAutoSuffix ? namesuffix(url) : url);
        getScript.call(m.host || this, true_url, function(){
            forEach.call(observers, function(args){
                args[0].call(args[1]);
            });
            _scripts[url] = 1;
            if (_refers[mname] && _refers[mname] !== 1) {
                _refers[mname].forEach(function(dm){
                    var b = this[dm.name];
                    if (--b[0] <= 0) {
                        this[dm.name] = 1;
                        fetch(dm, b[1]);
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
}

/**
 * @private search and sequence all dependencies, based on DFS
 * @param {string[]} a set of module names
 * @param {object[]} 
 * @param {object[]} a sequence of modules, for recursion
 * @return {object[]} a sequence of modules
 */ 
function scan(m, file_mod, list){
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
        var mid = realname(_mid);
        if (!_config.mods[mid] && !_builtin_mods[mid]) {
            var true_mid = realname(basename(_mid, file_mod));
            if (mid !== true_mid) {
                _config.mods[file_mod.url + ':' + mid] = true_mid;
                mid = true_mid;
            }
            if (!_config.mods[true_mid]) {
                define(true_mid, filesuffix(true_mid));
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
            scan.call(this, [deps[i]], file_mod, list);
        }
    }
    if (m) {
        tidy(deps, m);
        list.push(m);
    }
    return list;
}

/**
 * @experiment 
 * @private analyse module code 
 *          to find out dependencies which have no explicit declaration
 * @param {object} module object
 */ 
function seek(block){
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
}

function tidy(deps, m){
    forEach.call(deps.slice(), function(dep, i){
        var true_mid = this[m.url + ':' + realname(dep)];
        if (typeof true_mid === 'string') {
            deps[i] = true_mid;
        }
    }, _config.mods);
}

function config(opt){
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
                mods[k].name = realname(k);
                mods[mods[k].name] = mods[k];
            }
        } else {
            _config[i] = opt[i];
        }
    }
}

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
function namesuffix(file){
    return file.replace(/(.+?)(_src.*)?(\.\w+)$/, function($0, $1, $2, $3){
        return $1 + ($2 && '_combo' || '_pack') + $3;
    });
}

function filesuffix(mid){
    return _RE_SUFFIX.test(mid) ? mid : mid + '.js';
}

function realname(mid){
    var alias = _config.aliases;
    if (alias) {
        mid = mid.replace(_RE_ALIAS_IN_MID, function(e1, e2){
            return alias[e2] || (e2 + '/');
        });
    }
    return mid;
}

function basename(mid, file_mod){
    var rel_path = _RE_RELPATH.exec(mid);
    if (rel_path && file_mod) { // resolve relative path in Module ID
        mid = (file_mod.url || '').replace(/[^\/]+$/, '') + rel_path[0];
    }
    return resolvename(mid);
}

function resolvename(url){
    url = url.replace(_RE_DOT, '$1');
    var dots, dots_n, url_dup = url, RE_DOTS = /(\.\.\/)+/g;
    while (dots = (RE_DOTS.exec(url_dup) || [])[0]) {
        dots_n = dots.match(/\.\.\//g).length;
        url = url.replace(new RegExp('([^/\\.]+/){' + dots_n + '}' + dots), '');
    }
    return url.replace(/\/\//g, '/');
}

/**
 * @public non-blocking script loader
 * @param {string}
 * @param {object} config
 */ 
function getScript(url, op){
    var doc = isWindow(this) ? this.document : document,
        s = doc.createElement("script");
    s.type = "text/javascript";
    s.async = "async"; //for firefox3.6
    if (!op)
        op = {};
    else if (isFunction(op))
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
}

function isFunction(obj) {
    return _toString.call(obj) === "[object Function]";
}

function isArray(obj) {
    return _toString.call(obj) === "[object Array]";
}

function isWindow(obj) {
    return "setInterval" in obj;
}

function clone(obj) { // be careful of using `delete`
    function NewObj(){}
    NewObj.prototype = obj;
    return new NewObj();
}

var oz = {
    VERSION: '2.5.1',
    define: define,
    require: require,
    config: config,
    seek: seek,
    fetch: fetch,
    realname: realname,
    basename: basename,
    filesuffix: filesuffix,
    namesuffix: namesuffix,
    // non-core
    _getScript: getScript,
    _clone: clone,
    _forEach: forEach,
    _isFunction: isFunction,
    _isWindow: isWindow
};

require.config = config;
define.amd = { jQuery: true };

if (!window.window) { // for nodejs
    exports.oz = oz;
    exports._config = _config;
     // hook for build tool
    for (var i in oz) {
        exports[i] = oz[i];
    }
    var hooking = function(fname){
        return function(){ return exports[fname].apply(this, arguments); };
    };
    exec = hooking('exec');
    fetch = hooking('fetch');
    require = hooking('require');
    require.config = config;
} else {
    window.oz = oz;
    window.define = define;
    window.require = require;
}

})();

require.config({ enable_ozma: true });


/* @source mo/domready.js */;

/**
 * Non-plugin implementation of cross-browser DOM ready event
 * Based on OzJS's built-in module -- 'finish'
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/domready", [
  "finish"
], function(finish){
    var loaded, 
        w = this, 
        doc = w.document, 
        ADD = "addEventListener",
        IEADD = "attachEvent",
        READY = "DOMContentLoaded", 
        CHANGE = "onreadystatechange";

    if (doc.readyState === "complete") {
        setTimeout(finish, 1);
    } else {
        if (doc[ADD]){
            loaded = function(){
                doc.removeEventListener("READY", loaded, false);
                finish();
            };
            doc[ADD](READY, loaded, false);
            w[ADD]("load", finish, false);
        } else if (doc[IEADD]) {
            loaded = function(){
                if (doc.readyState === "complete") {
                    doc.detachEvent(CHANGE, loaded);
                    finish();
                }
            };
            doc[IEADD](CHANGE, loaded);
            w[IEADD]("load", finish);
            var toplevel = false;
            try {
                toplevel = w.frameElement == null;
            } catch(e) {}

            if (doc.documentElement.doScroll && toplevel) {
                var check = function(){
                    try {
                        doc.documentElement.doScroll("left");
                    } catch(e) {
                        setTimeout(check, 1);
                        return;
                    }
                    finish();
                };
                check();
            }
        }
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

    _aproto.forEach.call("Boolean Number String Function Array Date RegExp Object".split(" "), function(name , i){
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
        return "setInterval" in obj;
    };

	exports.isEmptyObject = function(obj) {
        for (var name in obj) {
            return false;
        }
        return true;
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
            if (Array.isArray(origin)) {
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
            if (Array.isArray(origin)) {
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

    EventAPI.wait = EventAPI.then;
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

    exports.VERSION = '2.0.0';

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

    function _apply(base, self, args){
        return base.apply(self, args);
    }

    exports.construct = function(base, mixes, factory){
        if (mixes && !Array.isArray(mixes)) {
            factory = mixes;
        }
        var proto = Object.create(base.prototype),
            supr = Object.create(base.prototype),
            constructor = function(){
                var self = this;
                this.constructor = constructor;
                this.superConstructor = function(){
                    _apply.prototype = base.prototype;
                    var su = new _apply(base, self, arguments);
                    for (var i in su) {
                        if (!self[i]) {
                            self[i] = supr[i] = su[i];
                        }
                    }
                };
                this.superClass = supr;
                return factory.apply(this, arguments);
            };
        constructor.prototype = proto;
        if (mixes) {
            mixes = mix.apply(this, mixes);
            mix(proto, mixes);
            mix(supr, mixes);
        }
        return constructor;
    };

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
            func = new Function(namespace || 'obj', 'api', 'var __p=[];' 
                + (namespace ? '' : 'with(obj){')
                    + 'var mix=api.mix,escapeHTML=api.escapeHTML,substr=api.substr,include=api.include,has=api._has(' + (namespace || 'obj') + ');'
                    + '__p.push(\'' +
                    str.replace(/\\/g, '\\\\')
                        .replace(/'/g, "\\'")
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
        }
        return !func ? '' : (data ? func(data, exports.tplHelpers) : func);
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
  "mo/lang/es5",
  "mo/lang/mix",
  "mo/lang/type"
], function(es5, _, detect){

    var window = this,
        doc = window.document,
        NEXT_SIB = 'nextElementSibling',
        PREV_SIB = 'prevElementSibling',
        FIRST_CHILD = 'firstElementChild',
        MATCHES_SELECTOR = ['webkitMatchesSelector', 'mozMatchesSelector', 'matchesSelector']
            .map(function(name){
                return this[name] && name;
            }, doc.body).filter(pick)[0],
        _MOE = 'MouseEvents',
        SPECIAL_EVENTS = { click: _MOE, mousedown: _MOE, mouseup: _MOE, mousemove: _MOE },
        CSS_NUMBER = { 
            'column-count': 1, 'columns': 1, 'font-weight': 1, 
            'line-height': 1, 'opacity': 1, 'z-index': 1, 'zoom': 1 
        },
        RE_HTMLTAG = /^\s*<(\w+|!)[^>]*>/,
        isFunction = detect.isFunction,
        _array_each = Array.prototype.forEach,
        _array_map = Array.prototype.map,
        _array_push = Array.prototype.push,
        _getComputedStyle = document.defaultView.getComputedStyle,
        _next_pointer,
        _elm_display = {},
        _html_containers = {};


    function $(selector, context){
        if (selector) {
            if (selector.constructor === $) {
                return selector;
            } else if (typeof selector !== 'string') {
                var nodes = new $();
                _array_push[selector.length !== undefined
                    && selector !== window ? 'apply' : 'call'
                ](nodes, selector);
                return nodes;
            } else if (RE_HTMLTAG.test(selector)) {
                return create_nodes(selector);
            } else if (context) {
                return $(context).find(selector);
            } else {
                return ext.find(selector);
            }
        }
    }

    var ext = $.fn = $.prototype = [];

    ['map', 'filter', 'slice', 'reverse', 'sort'].forEach(function(method){
        var origin = this['_' + method] = this[method];
        this[method] = function(){
            return $(origin.apply(this, arguments));
        };
    }, ext);

    ['splice', 'concat'].forEach(function(method){
        var origin = this['_' + method] = this[method];
        this[method] = function(){
            return $(origin.apply(this._slice(), _array_map.call(
                arguments, function(i){
                    return i._slice();
                })
            ));
        };
    }, ext);

    _.mix(ext, {

        constructor: $,

        // Traversing

        find: function(selector){
            var nodes = new $(), contexts;
            if (this === ext) {
                contexts = [doc];
            } else {
                nodes.prevObject = contexts = this;
            }
            if (/^#/.test(selector)) {
                var elm = doc.getElementById(selector.substr(1));
                if (elm) {
                    nodes.push(elm);
                }
            } else {
                var query = /\W/.test(selector) ? 'querySelectorAll' 
                                                : 'getElementsByTagName';
                if (contexts[1]) {
                    contexts.forEach(function(context){
                        this.push.apply(this, context[query](selector));
                    }, nodes);
                } else if (contexts[0]) {
                    nodes.push.apply(nodes, contexts[0][query](selector));
                }
            }
            return nodes;
        },

        eq: function(i){
            return i === -1 ? this.slice(-1) : this.slice(i, i + 1);
        },

        not: function(selector){
            return this.filter(function(node){
                return node && !this(node, selector);
            }, matches_selector);
        },

        has: function(selector){
            return this.filter(function(node){
                return this(node, selector);
            }, matches_selector);
        },

        parent: find_near('parentNode'),

        parents: function(selector){
            var ancestors = new $(), p = this,
                finding = selector ? find_selector(selector, 'parentNode') : function(node){
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
            return _.merge.apply(_, this.map(function(node){
                return this(node.children);
            }, $));
        },

        contents: function(){
            return _.merge.apply(_, this.map(function(node){
                return this(node.childNodes);
            }, $));
        },

        // Detection

        is: function(selector){
            return this.some(function(node){
                return matches_selector(node, selector);
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
            return foreach_farg(this, cname, 'className', function(node, cname){
                node.classList.add(cname);
            });
        },

        removeClass: function(cname){
            return foreach_farg(this, cname, 'className', function(node, cname){
                node.classList.remove(cname);
            });
        },

        toggleClass: function(cname, force){
            return foreach_farg(this, cname, 'className', function(node, cname){
                node.classList[typeof this === 'undefined' && 'toggle'
                                    || this && 'add' || 'remove'](cname);
            }, force);
        },

        attr: kv_access(function(node, name, value){
            node.setAttribute(name, value);
        }, function(node, name){
            return node && node.getAttribute(name);
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
            return (node || {})[name];
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
            return (node || {}).dataset[css_method(name)];
        }),

        removeData: function(name){
            this.forEach(function(node){
                delete node.dataset[this];
            }, name);
            return this;
        },

        val: function(value){
            var node = this[0];
            if (value === undefined) {
                if (node) {
                    if (node.multiple) {
                        return $('option', this).filter(function(item){
                            return item.selected;
                        }).map(function(item){
                            return item.value;
                        });
                    }
                    return node.value;
                }
            } else {
                return foreach_farg(this, value, 'value', function(node, value){
                    node.value = value;
                });
            }
        },

        empty: function(){
            this.forEach(function(node){
                node.innerHTML = '';
            });
            return this;
        },

        html: function(str){
            return str === undefined ? (this[0] || {}).innerHTML
                : foreach_farg(this, str, 'innerHTML', function(node, str){
                    if (RE_HTMLTAG.test(str)) {
                        this(node).empty().append(str);
                    } else {
                        node.innerHTML = str;
                    }
                }, $);
        },

        text: function(str){
            return str === undefined ? (this[0] || {}).textContent
                : foreach_farg(this, str, 'textContent', function(node, str){
                    node.textContent = str;
                });
        },

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
            return node && (node.style[css_method(name)] 
                || _getComputedStyle(node, '').getPropertyValue(name));
        }, function(self, dict){
            var prop, value, css = '';
            for (var name in dict) {
                value = dict[name];
                prop = css_prop(name);
                if (!value && value !== 0) {
                    self.forEach(function(node){
                        node.style.removeProperty(this);
                    }, prop);
                } else {
                    css += prop + ":" + css_unit(prop, value) + ';';
                }
            }
            self.forEach(function(node){
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
                if (this(node, '').getPropertyValue("display") === "none") {
                    node.style.display = default_display(node.nodeName);
                }
            }, _getComputedStyle);
            return this;
        },

        // Dimensions

        offset: function(){
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
            return foreach_farg(this, boxes, false, function(node, boxes){
                this(boxes).insertBefore(node).append(node);
            }, $);
        },

        wrapAll: function(boxes){
            $(boxes).insertBefore(this.eq(0)).append(this);
            return this;
        },

        wrapInner: function(boxes){
            return foreach_farg(this, boxes, false, function(node, boxes){
                this(node).contents().wrapAll(boxes);
            }, $);
        },

        unwrap: function(){
            this.parent().forEach(function(node){
                this(node).children().replaceAll(node);
            }, $);
            return this;
        },

        remove: function(){
            this.forEach(function(node){
                node.parentNode.removeChild(node);
            });
            return this;
        },

        // Event

        bind: event_access('add'),

        unbind: event_access('remove'),

        trigger: function(event, argv){
            if (typeof event === 'string') {
                event = Event(event);
            }
            _.mix(event, argv);
            this.forEach(event.type == 'submit' 
                && !event.defaultPrevented ? function(node){
                node.submit();
            } : function(node){
                if ('dispatchEvent' in node) {
                    node.dispatchEvent(this);
                }
            }, event);
            return this;
        },

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

    // private

    function pick(v){ 
        return v; 
    }

    function matches_selector(elm, selector){
        return elm && elm[MATCHES_SELECTOR](selector);
    }

    function find_selector(selector, attr){
        return function(node){
            if (attr) {
                node = node[attr];
            }
            if (matches_selector(node, selector)) {
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
                    if (n && matches_selector(n, selector)) {
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
                        || matches_selector(n, selector))) {
                        this.push(n);
                    }
                } while (n = n[prop]);
            }, sibs);
            return _.unique(sibs);
        };
    }

    function foreach_farg(nodes, arg, prop, cb, context){
        var is_fn_arg = isFunction(arg);
        nodes.forEach(function(node, i){
            cb.call(context, node, !is_fn_arg ? arg
                : arg.call(this, i, prop && node[prop]));
        }, nodes);
        return nodes;
    }

    function kv_access(setter, getter, map){
        return function(name, value){
            if (typeof name === 'object') {
                if (map) {
                    map(this, name);
                } else {
                    for (var k in name) {
                        this.forEach(function(node){
                            setter(node, this, name[this]);
                        }, k);
                    }
                }
            } else {
                if (value !== undefined) {
                    var is_fn_arg = isFunction(value);
                    this.forEach(function(node, i){
                        setter(node, name, !is_fn_arg ? value 
                            : value.call(this, i, getter(node, name)));
                    }, this);
                } else {
                    return getter(this[0], name);
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
                this.forEach(function(node){
                    node[action + 'EventListener'](subject, this, false);
                }, cb);
            }  // not support 'removeAllEventListener'
            return this;
        }
        return access;
    }

    function Event(type, props) {
        var bubbles = true,
            event = document.createEvent(SPECIAL_EVENTS[type] || 'Events');
        if (props) {
            if ('bubbles' in props) {
                bubbles = !!props.bubbles;
                delete props.bubbles;
            }
            _.mix(event, props);
        }
        event.initEvent(type, bubbles, true);
        return event;
    }

    function css_method(name){
        return name.replace(/-+(.)?/g, function($0, $1){
            return $1 ? $1.toUpperCase() : '';
        }); 
    }

    function css_prop(name) {
        return name.replace(/::/g, '/')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
            .replace(/([a-z\d])([A-Z])/g, '$1_$2')
            .replace(/_/g, '-')
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
            display = _getComputedStyle(tmp, '').getPropertyValue("display");
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
            var offset;
            return this[0] === window 
                ? window['inner' + method] 
                : this[0] === doc 
                    ? doc.documentElement['offset' + method] 
                    : (this.offset() || {})[method.toLowerCase()];
        };
    }

    function create_nodes(str, attrs){
        var tag = (RE_HTMLTAG.exec(str) || [])[0] || str;
        var temp = _html_containers[tag];
        if (!temp) {
            temp = _html_containers[tag] = tag === 'tr' && document.createElement('tbody')
                || (tag === 'tbody' || tag === 'thead' || tag === 'tfoot') 
                    && document.createElement('table')
                || (tag === 'td' || tag === 'th') && document.createElement('tr')
                || document.createElement('div');
        }
        temp.innerHTML = str;
        var nodes = new $();
        _array_push.apply(nodes, temp.childNodes);
        nodes.forEach(function(node){
            this.removeChild(node);
        }, temp);
        if (attrs) {
            for (var k in attrs) {
                nodes.attr(k, attrs[k]);
            }
        }
        return nodes;
    }

    function insert_node(target, node, action){
        if (node.nodeName.toUpperCase() === 'SCRIPT' 
                && (!node.type || node.type === 'text/javascript')) {
            window['eval'].call(window, node.innerHTML);
        }
        switch(action) {
            case 1: target.appendChild(node); break;
            case 2: target.parentNode.insertBefore(node, target); break;
            case 3: target.insertBefore(node, target.firstChild); break;
            case 4: target.parentNode.insertBefore(node, target.nextSibling); break;
            default: break;
        }
    }

    function insert_nodes(action, is_reverse){
        var fn = is_reverse ? function(target){
            insert_node(target, this, action);
        } : function(content){
            insert_node(this, content, action);
        };
        return function(elms){
            this.forEach(function(node){
                this.forEach(fn, node);
            }, $(elms));
            return this;
        };
    }

    function operator_insert_to(action){
        return insert_nodes(action, true);
    }

    function operator_insert(action){
        return insert_nodes(action);
    }

    // public static API

    $.find = $;
    $.matchesSelector = matches_selector;
    $.createNodes = create_nodes;
    $.camelize = css_method;
    $.dasherize = css_prop;
    $.Event = Event;

    $.VERSION = '1.0.2';

    return $;

});

/* @source moui/overlay.js */;

define('moui/overlay', [
  "dollar",
  "mo/lang",
  "mo/template",
  "eventmaster"
], function($, _, tpl, Event) {

    var body = $('body'),

        NS = 'mouiOverlay',
        TPL_VIEW =
           '<div id="{{id}}" class="moui-overlay">\
                <header><h2></h2></header>\
                <div class="moui-overlay-content"></div>\
            </div>',
        LOADING_DOTS = '<span class="loading"><i>.</i><i>.</i><i>.</i></span>',
        LOADING_DEFAULT = '加载中',

        _mid = 0,

        default_config = {
            title: '',
            content: '',
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
            this.event = Event();
            this._config = _.mix({}, this._defaults, opt);
            body.append(tpl.format(this._template, { 
                id: this.id 
            }));
            this._node = $('#' + this.id);
            this._header = this._node.find('header').eq(0);
            this._title = this._header.find('h1');
            this._content = this._node.find('.moui-overlay-content');
        },

        set: function(opt) {

            var self = this;
            this._config = _.mix(this._config, opt);

            if (typeof opt.title === 'string') {
                this.setTitle(opt.title);
            }

            if (opt.content !== undefined) {
                this.setContent(opt.content);
            }

            return this;

        },

        setTitle: function(text){
            this._title.html(text);
        },

        setContent: function(html){
            this._content.html(html);
        },

        showLoading: function(text) {
            this._title.html((text || LOADING_DEFAULT) + LOADING_DOTS);
            return this;
        },

        hideLoading: function(){
            this._title.html(this._config.title);
        },

        open: function() {
            if (this.opened) {
                return;
            }
            this.opened = true;
            this._node.appendTo(body).addClass('active');
            this.event.fire('open', [this]);
            return this;
        },

        close: function() {
            if (!this.opened) {
                return;
            }
            this.opened = false;
            this.event.fire('close', [this]);
            this._node.removeClass('active');
            return this;
        },

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

    var match, skin, 
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
        var ua = navigator.userAgent.toLowerCase(),
            rmobilesafari = /apple.*mobile.*safari/,
            rwebkit = /(webkit)[ \/]([\w.]+)/,
            ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/,
            rmsie = /(msie) ([\w.]+)/,
            rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;

        var r360se = /(360se)/,
            r360ee = /(360ee)/,
            rtheworld = /(theworld)/,
            rmaxthon3 = /(maxthon\/3)/,
            rmaxthon = /(maxthon)\s/,
            rtt = /(tencenttraveler)/,
            rqq = /(qqbrowser)/,
            rmetasr = /(metasr)/;

        match = rmobilesafari.test(ua) && [0, "mobilesafari"] ||
            rwebkit.exec(ua) ||
            ropera.exec(ua) ||
            rmsie.exec(ua) ||
            ua.indexOf("compatible") < 0 && rmozilla.exec(ua) ||
            [];

        skin = r360se.exec(ua) || r360ee.exec(ua) || rtheworld.exec(ua) || 
            rmaxthon3.exec(ua) || rmaxthon.exec(ua) ||
            rtt.exec(ua) || rqq.exec(ua) ||
            rmetasr.exec(ua) || [];

    } catch (ex) {
        match = [];
        skin = [];
    }

    var result = { 
        browser: match[1] || "", 
        version: match[2] || "0",
        skin: skin[1] || ""
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

/* @source mo/network/ajax.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/network/ajax", [
  "mo/browsers"
], function(browsers, require, exports){

    var httpParam = function(a) {
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

    /**
     * From jquery by John Resig
     */ 
    var ajax = function(s){
        var options = {
            type: s.type || "GET",
            url: s.url || "",
            data: s.data || null,
            dataType: s.dataType,
            contentType: s.contentType || "application/x-www-form-urlencoded",
            username: s.username || null,
            password: s.password || null,
            timeout: s.timeout || 0,
            processData: s.processData || true,
            beforeSend: s.beforeSend || function(){},
            complete: s.complete || function(){},
            handleError: s.handleError || function(){},
            success: s.success || function(){},
            accepts: {
                xml: "application/xml, text/xml",
                html: "text/html",
                script: "text/javascript, application/javascript",
                json: "application/json, text/javascript",
                text: "text/plain",
                _default: "*/*"
            }
        };
        
        if ( options.data && options.processData && typeof options.data != "string" )
            options.data = httpParam(options.data);
        if ( options.data && options.type.toLowerCase() == "get" ) {
            options.url += (options.url.match(/\?/) ? "&" : "?") + options.data;
            options.data = null;
        }
        
        var status, data, requestDone = false, xhr = window.ActiveXObject ? new ActiveXObject("Microsoft.XMLHTTP") : new XMLHttpRequest();
        xhr.open( options.type, options.url, true, options.username, options.password );
        try {
            if ( options.data )
                xhr.setRequestHeader("Content-Type", options.contentType);
            xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            xhr.setRequestHeader("Accept", s.dataType && options.accepts[ s.dataType ] ?
                options.accepts[ s.dataType ] + ", */*" :
                options.accepts._default );
        } catch(e){}
        
        if ( options.beforeSend )
            options.beforeSend(xhr);
            
        var onreadystatechange = function(isTimeout){
            if ( !requestDone && xhr && (xhr.readyState == 4 || isTimeout == "timeout") ) {
                requestDone = true;
                if (ival) {
                    clearInterval(ival);
                    ival = null;
                }

                status = isTimeout == "timeout" && "timeout" || !httpSuccess( xhr ) && "error" || "success";

                if ( status == "success" ) {
                    try {
                        data = httpData( xhr, options.dataType );
                    } catch(e) {
                        status = "parsererror";
                    }
                    
                    options.success( data, status );
                } else
                    options.handleError( xhr, status );
                options.complete( xhr, status );
                xhr = null;
            }
        };

        var ival = setInterval(onreadystatechange, 13); 
        if ( options.timeout > 0 )
            setTimeout(function(){
                if ( xhr ) {
                    xhr.abort();
                    if( !requestDone )
                        onreadystatechange( "timeout" );
                }
            }, options.timeout);    
            
        xhr.send(options.data);

        function httpSuccess(r) {
            try {
                return !r.status && location.protocol == "file:" || ( r.status >= 200 && r.status < 300 ) || r.status == 304 || r.status == 1223 || browsers.safari && r.status == undefined;
            } catch(e){}
            return false;
        }
        function httpData(r,type) {
            var ct = r.getResponseHeader("content-type");
            var xml = type == "xml" || !type && ct && ct.indexOf("xml") >= 0;
            var data = xml ? r.responseXML : r.responseText;
            if ( xml && data.documentElement.tagName == "parsererror" )
                throw "parsererror";
            if ( type == "script" )
                eval.call( window, data );
            if ( type == "json" )
                data = eval("(" + data + ")");
            return data;
        }
        return xhr;
    };

    exports.ajax = ajax;
    exports.params = httpParam;

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
], function(_, net, require, exports){

    var window = this,
        uuid4jsonp = 1;

    _.mix(exports, net);

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
        url = [url, /\?/.test(url) ? "&" : "?", exports.httpParam(data)].join("");
        if (fn) {
            _.ns(op.callback, fn);
        }
        delete op.callback;
        exports.getScript(url, op);
    };

    exports.getRequest = function(url, params){
        var img = new Image();
        img.onload = function(){ img = null; }; //阻止IE下的自动垃圾回收引起的请求未发出状况
        img.src = !params ? url : [url, /\?/.test(url) ? "&" : "?", typeof params == "string" ? params : exports.httpParam(params)].join('');
    };

});

/* @source moui/modalview.js */;

define('moui/modalview', [
  "dollar",
  "mo/lang",
  "mo/network",
  "mo/template",
  "moui/overlay"
], function($, _, net, tpl, overlay) {

    var body = $('body'),
        mix = _.mix,

        NS = 'mouiModalView',
        TPL_VIEW =
           '<div id="{{id}}" class="moui-modalview">\
                <div class="shd"></div>\
                <div class="wrapper">\
                    <header>\
                        <div class="confirm"></div>\
                        <div class="cancel"></div>\
                        <h1></h1>\
                    </header>\
                    <div class="moui-modalview-content"></div>\
                </div>\
            </div>',
        TPL_BTN = '<button class="{{type}}" data-default={{isDefault}}>{{text}}</button>',

        button_config = {
            'confirm': {
                type: 'confirm',
                text: '确定',
                isDefault: true,
                method: function(modal) {
                    modal.event.fire('confirm', [modal]);
                    modal.submit(function() {
                        modal.hideLoading();
                        modal.close();
                    });
                    modal.showLoading('提交中');
                }
            }, 
            'cancel': {
                type: 'cancel',
                text: '取消',
                method: function(modal) {
                    modal.event.fire('cancel', [modal]);
                    modal.close();
                }
            }
        },

        default_config = mix(overlay.Overlay.prototype, {
            url: null,
            buttons: ['confirm', 'cancel']
        });


    var ModalView = _.construct(overlay.Overlay, function(opt){
        this.init(opt);
        var self = this,
            handlers = this._btnHandlers = {};
        this._wrapper = this._node.find('.wrapper').eq(0);
        this._content = this._wrapper.find('.moui-modalview-content');
        this._confirmBtn = this._header.find('.confirm');
        this._cancelBtn = this._header.find('.cancel');
        this._confirmBtn.concat(this._cancelBtn).bind('click', function(e){
            (handlers[this.className] || nothing).call(this, self, e);
        });
        this.set(this._config);
    });

    mix(ModalView.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: default_config,

        set: function(opt) {

            this.superClass.set.call(this, opt);
            var self = this;

            if (opt.buttons && opt.buttons.length > 0) {
                var handlers = this._btnHandlers, 
                    btn_lib = _.index(opt.buttons.map(function(btn){
                        return typeof btn === 'object' ? btn : { type: btn };
                    }), 'type');
                default_config.buttons.forEach(function(type) {
                    var btn = btn_lib[type];
                    btn = btn && mix({}, button_config[type], btn) || {};
                    handlers[type] = btn.method;
                    this['_' + type + 'Btn'].html(function(){
                        return btn && tpl.format(TPL_BTN, btn) || '';
                    });
                }, this);
            }

            if (opt.url) {
                self.showLoading();
                net.ajax({
                    url: opt.url,
                    dataType: opt.urlType || 'text',
                    success: function(data){
                        if (opt.urlType === 'json') {
                            data = data.html;
                        }
                        self.setContent(data);
                        self.hideLoading();
                    }
                });
            }

            return this;

        },

        submit: function(callback){
            this._content.find('form').bind(callback).trigger('submit');
        },

        destroy: function() {
            this._btnHandlers = {};
            return this.superClass.destroy.call(this);
        }

    });

    function nothing(){}

    function exports(opt) {
        return new exports.ModalView(opt);
    }

    exports.ModalView = ModalView;

    return exports;

});

/* @source ../cardkit/view/modal.js */;

define("../cardkit/view/modal", [
  "moui/modalview"
], function(Modal) {

    var modal = Modal({
        buttons: [{
            type: 'cancel',
            method: function(modal){
                modal.event.fire('cancel', [modal]);
                history.back();
            }
        }, {
            type: 'confirm',
            method: function(modal){
                modal.event.fire('confirm', [modal]);
                modal.submit(function() {
                    modal.hideLoading();
                    history.back();
                });
                modal.showLoading('提交中');
            }
        }]
    });

    return modal;

});

/* @source ../tpl/items.js */;

define("../tpl/items", [], function(){

    return {"template":"\n<ul>\n{% mod.items.forEach(function(item){ %}\n    <li class=\"ck-item\">\n        <a class=\"ck-link\" href=\"{%= item.href %}\">{%= item.title %}</a>\n        <span class=\"info\">{%= item.info %}</span>\n    </li>\n{% }); %}\n</ul>\n"}; 

});
/* @source ../cardkit/view/parser.js */;

define("../cardkit/view/parser", [
  "dollar",
  "mo/lang",
  "mo/template",
  "tpl/items"
], function($, _, tpl, tpl_items){
    
    function exports(wrapper){

        var raw = wrapper.find('.ck-raw'),
            cards = wrapper.find('.ck-card'),
            listContents = wrapper.find('.ck-list');

        wrapper.find('.ck-list').forEach(function(list){
            list = $(list);
            var source = get_source(list);
            if (!source) {
                list.find('.ck-item').forEach(function(item){
                    item = $(item);
                    var source = get_source(item);
                    if (!source || !source[0]) {
                        return;
                    }
                    var link = item.find('.ck-link');
                    if (!link[0]) {
                        link = source.find('.ckd-link').clone();
                        link[0].className = 'ck-link';
                        //link.append()
                    } else {
                        var hd = source.find('.ckd-hd').html();
                        if (hd) {
                            item.find('.ck-link').html(hd.trim());
                        } else {
                            item.remove();
                        }
                    }
                });
            } else if (source[0]) {
                var items = source.find('.ckd-item').map(function(item){
                    var link = $('.ckd-link', item),
                        info = $('.ckd-info', item);
                    return {
                        href: link.attr('href'),
                        title: link.text(),
                        info: info.text()
                    };
                });
                if (!items.length) {
                    return;
                }
                list[0].innerHTML = tpl.convertTpl(tpl_items.template, {
                    items: items
                }, 'mod');
            }
        });

        wrapper.find('.ck-text').forEach(render_content);

        function render_content(mod){
            mod = $(mod);
            var source = get_source(mod);
            if (!source) {
                return mod.find('.ckd-content').forEach(render_content);
            } else if (!source[0]) {
                return;
            }
            var content = source.find('.ckd-content');
            if (!content[0]) {
                content = source.html();
                if (!/<\w+/.test(content)) {
                    return;
                }
            } else {
                content = content.clone();
            }
            if (mod.hasClass('ck-text')) {
                mod.empty().append(content);
            } else {
                mod.replaceWith(content);
            }
        }

        function get_source(me){
            var source_id = me.data('source');
            if (!source_id) {
                return false;
            }
            var source = raw.find('.' + source_id);
            return source;
        }

    }

    return exports;

});

/* @source ../cardkit/pagesession.js */;


define("../cardkit/pagesession", [
  "mo/lang"
], function(_){

    var window = this;

    var exports = {

        init: function(){
            this.name = 'ck_ss';
            if (sessionStorage[this.name]) {
                this.list = JSON.parse(sessionStorage[this.name]);
            } else {
                this.reset();
            }
        },

        reset: function(){
            this.list = [];
            this.save();
        },

        save: function(){
            sessionStorage[this.name] = JSON.stringify(this.list);
        },

        indexOf: function(url){
            var n = this.list.map(function(item){
                return item[0];
            }).indexOf(url);
            return (n === -1 || this.list[n][1] < history.length) ? n : -1;
        },

        push: function(url){
            this.list.push([url, history.length]);
            this.save();
        },

        clear: function(n){
            if (n !== -1) {
                this.list = this.list.slice(0, n + 2);
                this.save();
            }
        }

    };

    return exports;

});

/* @source ../cardkit/bus.js */;

define("../cardkit/bus", [
  "eventmaster"
], function(Event){

    return Event();

});

/* @source moui/gesture/base.js */;


define('moui/gesture/base', [
  "mo/lang/es5",
  "mo/lang/type",
  "mo/lang/mix"
], function(es5, type, _){

    var isFunction = type.isFunction,
        gid = 0;

    function GestureBase(elm, opt, cb){
        if (isFunction(opt)) {
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

    GestureBase.prototype = {

        PRESS: 'touchstart',
        MOVE: 'touchmove',
        RELEASE: 'touchend',
        //CANCEL: 'touchcancel',

        EVENTS: [],
        DEFAULT_CONFIG: {},

        config: function(opt){
            _.merge(_.mix(this._config, opt), this.DEFAULT_CONFIG);
            return this;
        },

        enable: function(){
            var self = this;
            self.bind(self.PRESS, 
                    self._press || (self._press = self.press.bind(self)))
                .bind(self.MOVE, 
                    self._move || (self._move = self.move.bind(self)))
                //.bind(self.CANCEL, 
                    //self._cancel || (self._cancel = self.cancel.bind(self)))
                .bind(self.RELEASE, 
                    self._release || (self._release = self.release.bind(self)));
            if (self._listener) {
                self.bind(this.event[this._config.event], self._listener);
            }
            return self;
        },

        disable: function(){
            var self = this;
            self.unbind(self.PRESS, self._press)
                .unbind(self.MOVE, self._move)
                //.unbind(self.CANCEL, self._cancel)
                .unbind(self.RELEASE, self._release);
            if (self._listener) {
                self.unbind(this.event[this._config.event], self._listener);
            }
            return self;
        },

        // implement

        bind: nothing,

        unbind: nothing,

        trigger: nothing,

        // extension

        press: nothing,

        move: nothing,

        release: nothing,

        cancel: nothing
    
    };

    function nothing(){}

    function exports(elm, opt, cb){
        return new exports.GestureBase(elm, opt, cb);
    }

    exports.GestureBase = GestureBase;

    return exports;

});

/* @source moui/gesture/scroll.js */;


define('moui/gesture/scroll', [
  "mo/lang",
  "moui/gesture/base"
], function(_, gesture){

    var ScrollGesture = _.construct(gesture.GestureBase, function(elm, opt, cb){
        this._startPos = { x: 0, y: 0 };
        this._movePos = { x: 0, y: 0 };
        return this.superConstructor(elm, opt, cb);
    });

    _.mix(ScrollGesture.prototype, {

        EVENTS: ['scrolldown', 'scrollup'],
        DEFAULT_CONFIG: {
            'directThreshold': 20
        },

        press: function(e){
            this._startTime = +new Date();
            var t = e.touches[0];
            this._startPos.y = t.clientY;
            this._movePos.y = 0;
        },

        move: function(e){
            var t = e.touches[0];
            this._movePos.y = t.clientY;
        },

        release: function(e){
            var self = this;
            var d = self._movePos.y - self._startPos.y,
                threshold = this._config.directThreshold;
            if (d < 0 - threshold) {
                self.trigger(e, self.event.scrolldown);
            } else if (d > threshold) {
                self.trigger(e, self.event.scrollup);
            }
        }
    
    });

    function exports(elm, opt, cb){
        return new exports.ScrollGesture(elm, opt, cb);
    }

    exports.ScrollGesture = ScrollGesture;

    return exports;

});

/* @source moui/gesture/drag.js */;


define('moui/gesture/drag', [
  "mo/lang",
  "moui/gesture/base"
], function(_, gesture){

});

/* @source moui/gesture/swipe.js */;


define('moui/gesture/swipe', [
  "mo/lang",
  "moui/gesture/base"
], function(_, gesture){

});

/* @source moui/gesture/tap.js */;


define('moui/gesture/tap', [
  "mo/lang",
  "moui/gesture/base"
], function(_, gesture){

    var TapGesture = _.construct(gesture.GestureBase, function(elm, opt, cb){
        this._startPos = { x: 0, y: 0 };
        this._movePos = { x: 0, y: 0 };
        return this.superConstructor(elm, opt, cb);
    });

    _.mix(TapGesture.prototype, {

        EVENTS: ['tap', 'doubletap', 'hold'],
        DEFAULT_CONFIG: {
            'tapRadius': 5,
            'doubleTimeout': 300,
            'holdThreshold': 500
        },

        press: function(e){
            clearTimeout(this._doubleTimer);
            this._startTime = +new Date();
            var t = e.touches[0];
            this._startPos.x = t.clientX;
            this._startPos.y = t.clientY;
            this._movePos.x = this._movePos.y = NaN;
        },

        move: function(e){
            var t = e.touches[0];
            this._movePos.x = t.clientX;
            this._movePos.y = t.clientY;
        },

        release: function(e){
            var self = this,
                is_double = self._isDouble,
                d = +new Date();
            self._isDouble = false;
            if (Math.abs(self._movePos.x - self._startPos.x) > self._config.tapRadius
                    || Math.abs(self._movePos.y - self._startPos.y) > self._config.tapRadius) {
                return;
            }
            if (d - self._startTime > self._config.holdThreshold) {
                self.trigger(e, self.event.hold);
            } else {
                if (is_double) {
                    self.trigger(e, self.event.doubletap);
                } else {
                    self.trigger(e, self.event.tap);
                    self._isDouble = true;
                    self._doubleTimer = setTimeout(function(){
                        self._isDouble = false;
                    }, 300);
                }
            }
        }
    
    });

    function exports(elm, opt, cb){
        return new exports.TapGesture(elm, opt, cb);
    }

    exports.TapGesture = TapGesture;

    return exports;

});

/* @source choreo.js */;

/**
 * ChoreoJS
 * An animation library which uses "stage" and "actor" as metaphors
 * Automatic switch between CSS transitions and JS tweening
 * Provide a flexible way to write asynchronous sequence of actions
 * Support CSS transform value
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("choreo", [
  "mo/lang/es5",
  "mo/lang/mix",
  "mo/mainloop",
  "eventmaster"
], function(es5, _, mainloop, Event){

    var window = this,
        VENDORS = ['', 'Moz', 'webkit', 'ms', 'O'],
        EVENT_NAMES = {
            '': 'transitionend',
            'Moz': 'transitionend',
            'webkit': 'webkitTransitionEnd',
            'ms': 'MSTransitionEnd',
            'O': 'oTransitionEnd'
        },
        TRANSIT_EVENT,
        TRANSFORM_PROPS = { 'rotate': -2, 
            'rotateX': -1, 'rotateY': -1, 'rotateZ': -1, 
            'scale': 2, 'scale3d': 3, 
            'scaleX': -1, 'scaleY': -1, 'scaleZ': -1, 
            'skew': 2, 'skewX': -1, 'skewY': -1, 
            'translate': 2, 'translate3d': 3, 
            'translateX': -1, 'translateY': -1, 'translateZ': -1 },
        TRANSFORM_DEFAULT = 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)'
            + ' translateX(0px) translateY(0px) translateZ(0px)'
            + ' scaleX(1) scaleY(1) scaleZ(1) skewX(0deg) skewY(0deg)',
        ACTOR_OPS = ['target', 'prop', 'duration', 'easing', 'delay', 'to'],
        RE_TRANSFORM = /(\w+)\(([^\)]+)/,
        RE_PROP_SPLIT = /\)\s+/,
        RE_UNIT = /^[-\d\.]+/,
        test_elm = window.document.body,
        _arry_push = Array.prototype.push,
        _array_slice = Array.prototype.slice,
        _getComputedStyle = (document.defaultView || {}).getComputedStyle,
        vendor_prop = { 'transform': '', 'transition': '' },
        useCSS = false,
        parent_id = 0,
        hash_id = 0,
        stage_id = 0,
        render_id = 0,
        _hash_pool = [],
        _stage = {},
        _transition_sets = {},
        _transform_promise = {},
        timing_values = {
            linear: 'linear',
            easeIn: 'ease-in',
            easeOut: 'ease-out',
            easeInOut: 'ease-in-out'
        },
        timing_functions = {
            linear: function(x, t, b, c) {
                return b + c * x;
            },
            easeIn: function (x, t, b, c, d) {
                return c*(t/=d)*t + b;
            },
            easeOut: function (x, t, b, c, d) {
                return -c *(t/=d)*(t-2) + b;
            },
            easeInOut: function (x, t, b, c, d) {
                if ((t/=d/2) < 1) return c/2*t*t + b;
                return -c/2 * ((--t)*(t-2) - 1) + b;
            }
        };

    function fix_prop_name(lib, prefix, true_prop, succ){
        for (var prop in lib) {
            true_prop = prefix ? ('-' + prefix + '-' + prop) : prop;
            if (css_method(true_prop) in test_elm.style) {
                lib[prop] = true_prop;
                TRANSIT_EVENT = EVENT_NAMES[prefix];
                succ = true;
                continue;
            }
        }
        return succ;
    }
    
    for (var i = 0, l = VENDORS.length; i < l; i++) {
        if (fix_prop_name(vendor_prop, VENDORS[i])) {
            break;
        }
    }
    fix_prop_name(vendor_prop, '');

    var TRANSFORM = vendor_prop['transform'],
        TRANSITION = vendor_prop['transition'],
        TRANSFORM_METHOD = css_method(TRANSFORM),
        TRANSITION_METHOD = css_method(TRANSITION); 
    if (TRANSFORM_METHOD && TRANSITION_METHOD) {
        useCSS = true;
    }

    function Stage(name){
        if (!name) {
            name = '_oz_choreo_' + stage_id++;
        }
        if (_stage[name]) {
            return _stage[name];
        }
        var self = this;
        _stage[name] = this;
        this.name = name;
        this._promise = new Event.Promise();
        this._reset_promise = new Event.Promise();
        this._count = 0;
        this._optCache = [];
        if (useCSS) {
            this._runningActors = [];
        } else {
            mainloop.addStage(name);
        }
        this._reset_promise.bind(function(){
            self._promise.reset();
        });
    }

    Stage.prototype = {

        isPlaying: function(){
            return useCSS ? !!this._runningActors.state 
                : mainloop.isRunning(this.name);
        },

        isCompleted: function(){
            return this._count <= 0;
        },

        play: function(){
            // reinitialize all user-written opts if stage has completed
            if (this.isCompleted()) {
                clearTimeout(this._end_timer);
                this._reset_promise.fire();
                this._optCache.forEach(function(opt){
                    this.actor(opt);
                }, this);
            }
            // nothing happen if stage is running
            if (useCSS) {
                if (!this.isPlaying()) {
                    this._runningActors.state = 1;
                    this._runningActors.forEach(play);
                }
            } else {
                mainloop.run(this.name);
            }
            return this;
        },

        pause: function(){
            if (useCSS) {
                this._runningActors.state = 0;
                this._runningActors.forEach(stop);
            } else {
                mainloop.pause(this.name);
            }
            return this;
        },

        clear: function(){
            this.cancel();
            // remove all all user-written opts
            this._optCache.forEach(function(opt){
                opt._cached = false;
            });
            this._optCache.length = 0;
            return this;
        },

        cancel: function(){
            to_end(this, function(name, opt){
                if (useCSS) {
                    stop(opt);
                } else {
                    mainloop.remove(name);
                }
            });
            this._optCache.forEach(function(opt){
                opt._promise.reject([{
                    target: opt.target, 
                    succ: false
                }]).disable();
            });
            return this;
        },

        complete: function(){
            to_end(this, function(name, opt){
                if (useCSS) {
                    complete(opt);
                    opt._promise.resolve([{
                        target: opt.target, 
                        succ: true 
                    }]).disable();
                } else {
                    mainloop.complete(name);
                }
            });
            return this;
        },

        actor: function(opt, opt2){
            var self = this, name = this.name, actorObj, actors;

            // when new actor coming, cancel forthcoming complete event 
            clearTimeout(this._end_timer);

            // Actor Group
            if (opt2) {
                if (opt.nodeType) { // convert jquery style to mutiple Single Actor
                    var base_opt = {}, props;
                    ACTOR_OPS.forEach(function(op, i){
                        if (op === 'prop') {
                            props = this[i];
                        } else if (op !== 'to') {
                            base_opt[op] = this[i];
                        }
                    }, arguments);
                    actors = Object.keys(props).map(function(prop){
                        return self.actor(_.mix({ 
                            _parent: true,
                            prop: prop,
                            to: props[prop]
                        }, this));
                    }, base_opt);
                    if (actors.length === 1) {
                        return actors[0];
                    }
                } else { // convert multiple options to mutiple Single Actor
                    actors = _array_slice.call(arguments);
                    actors = actors.map(function(sub_opt){
                        sub_opt._parent = true;
                        return self.actor(sub_opt);
                    });
                }
                this._reset_promise.bind(when_reset);
                return actorObj = new Actor(actors, self);
            }

            // normalize opt 
            opt.prop = vendor_prop[opt.prop] || opt.prop;

            // reset opt
            if (opt._promise) {
                when_reset(opt._promise);
            }
            // @TODO avoid setting the same prop

            // convert from Transform Actor to Actor Group
            if (opt.prop === TRANSFORM) { 
                var transform_promise = promise_proxy(opt.target);
                actors = split_transform(opt.to, function(sub_opt){
                    _.merge(sub_opt, opt);
                    sub_opt._parent = true;
                    sub_opt._promise = transform_promise;
                    return self.actor(sub_opt);
                });
                this._reset_promise.bind(when_reset);
                return actorObj = new Actor(actors, self);
            }

            self._count++; // count actors created by user

            // Single Actor or Split Actor
            if (!opt._promise) {
                opt._promise = new Event.Promise();
            }
            if (useCSS) {
                this._runningActors.push(opt);
                if (this.isPlaying()) {
                    play(opt);
                }
            } else {
                render_opt(name, opt);
            }
            actorObj = new Actor(opt, self);

            if (!opt._cached) {
                // cache Single Actor and Split Actor
                opt._cached = true;
                this._optCache.push(opt);

                watch(actorObj);
            }

            function when_reset(promise){
                (promise || actorObj.follow()).reset().enable();
            }

            function watch(actor){
                actor.follow().bind(watcher);
                actor._opt._watcher = watcher;
                delete actor._opt._parent;
                return actor;
            }

            function watcher(res){
                if (--self._count > 0) {
                    return;
                }
                self._end_timer = setTimeout(function(){
                    to_end(self);
                    self._promise[
                        res.succ ? 'resolve': 'reject'
                    ]([{ succ: res.succ }]);
                }, 0);
            }

            return actorObj;
        },

        group: function(actor){
            var self = this,
                actorObj,
                actors = _array_slice.call(arguments).filter(function(actor){
                    return actor.stage === self;
                });
            this._reset_promise.bind(function(){
                actorObj.follow().reset().enable();
            });
            return actorObj = new Actor(actors, self);
        },

        follow: function(){
            return this._promise;
        }

    };

    function Actor(opt, stage){
        if (Array.isArray(opt)) { // Actor Group
            this.members = opt;
            opt = {
                _promise: Event.when.apply(Event, 
                    this.members.map(function(actor){
                        return actor.follow();
                    })
                )
            };
            opt._promise.bind(opt._promise.pipe.disable);
        }
        this._opt = opt;
        this.stage = stage;
    }

    Actor.prototype = {

        enter: function(stage){
            if (this.stage) {
                this.exit();
            }
            var actor = stage.actor.apply(
                stage, 
                [].concat(actor_opts(this))
            );
            actor.follow().merge(this.follow());
            return _.mix(this, actor);
        },

        exit: function(){
            var stage = this.stage,
                opt = this._opt;
            if (!stage) {
                return this;
            }
            if (this.members) {
                this.members = this.members.map(function(actor){
                    return actor.exit();
                });
            } else {
                if (useCSS) {
                    clear_member(stage._runningActors, opt);
                    if (stage.isPlaying()) {
                        stop(opt);
                    }
                } else {
                    mainloop.remove(stage.name, opt._render);
                }
                clear_member(stage._optCache, opt);
                opt._promise.reject([{
                    target: opt.target, 
                    succ: false
                }]).disable();
                // @TODO remove when_reset
            }
            var actor = this.fork();
            if (!opt._parent) {
                actor.follow().merge(opt._promise);
            }
            _.occupy(opt, actor._opt);
            delete this.stage;
            return this;
        },

        fork: function(){
            if (this.members) {
                return new Actor(this.members.map(function(actor){
                    return actor.fork();
                }));
            }
            var opt = {};
            ACTOR_OPS.forEach(function(i){
                opt[i] = this[i];
            }, this._opt);
            opt._promise = new Event.Promise(); // useless for member actor
            return new Actor(opt);
        },

        setto: function(v){
            return actor_setter(this, v, function(opt, v){
                return (v || v === 0) ? v : opt.to;
            });
        },

        extendto: function(v){
            return actor_setter(this, v, function(opt, v){
                if (!v) {
                    return opt.to;
                }
                var unit = get_unit(opt.to, v);
                return parseFloat(opt.to) + parseFloat(v) + unit;
            });
        },

        reverse: function(){
            return actor_setter(this, {}, function(opt){
                return opt.from !== undefined 
                    ? opt.from : opt._current_from;
            });
        },

        follow: function(){
            return this._opt._promise;
        }
        
    };

    function to_end(stage, fn){
        if (useCSS) {
            var _actors = stage._runningActors;
            if (stage.isPlaying()) {
                _actors.forEach(function(opt){
                    if (fn) {
                        fn(stage.name, opt);
                    }
                });
                _actors.state = 0;
                _actors.length = 0;
            }
        } else if (fn) {
            fn(stage.name);
        }
    }

    function stop(opt){
        var elm = opt.target,
            from = parseFloat(opt._current_from || opt.from),
            end = parseFloat(opt.to),
            d = end - from,
            time = opt._startTime ? (+new Date() - opt._startTime) : 0;
        if (time < 0) {
            time = 0;
        }
        var progress = time / (opt.duration || 1),
            hash = elm2hash(elm),
            sets = _transition_sets[hash];
        if (sets && sets[opt.prop] === opt) {
            clearTimeout((sets[opt.prop] || {})._runtimer);
            delete sets[opt.prop];
        } else {
            progress = 0;
        }
        if (!progress) {
            return;
        }
        var str = transitionStr(hash);
        elm.style[TRANSITION_METHOD] = str;
        if (progress < 1) { // pause
            if (timing_functions[opt.easing]) {
                progress = timing_functions[opt.easing](progress, time, 0, 1, opt.duration);
            }
            var unit = get_unit(opt.from, opt.to);
            from = from + d * progress + unit;
        } else { // complete
            from = opt.to;
        }
        set_style_prop(elm, opt.prop, from);
    }

    function complete(opt){
        var elm = opt.target,
            hash = elm2hash(elm),
            sets = _transition_sets[hash];
        if (sets) {
            delete sets[opt.prop];
        }
        var str = transitionStr(hash);
        elm.style[TRANSITION_METHOD] = str;
        set_style_prop(elm, opt.prop, opt.to);
    }

    function play(opt){
        var elm = opt.target,
            prop = opt.prop,
            hash = elm2hash(elm),
            sets = _transition_sets[hash],
            from = opt.from || get_style_value(elm, prop);
        if (from == opt.to) { // completed
            var completed = true;
            if (sets) {
                delete sets[prop];
            }
            if (TRANSFORM_PROPS[prop]) {
                for (var p in sets) {
                    if (TRANSFORM_PROPS[p]) {
                        completed = false; // wait for other transform prop
                        break;
                    }
                }
            }
            if (completed) {
                opt._promise.resolve([{
                    target: opt.target, 
                    succ: true 
                }]).disable();
            }
            return;
        }
        opt._current_from = from; // for pause or reverse
        opt._startTime = +new Date() + (opt.delay || 0);
        sets[prop] = opt;
        set_style_prop(elm, prop, from);
        var str = transitionStr(hash);
        opt._runtimer = setTimeout(function(){
            delete opt._runtimer;
            elm.style[TRANSITION_METHOD] = str;
            set_style_prop(elm, prop, opt.to);
        }, 0);
    }

    function render_opt(name, opt){
        var elm = opt.target,
            end = parseFloat(opt.to),
            from = opt.from || get_style_value(opt.target, opt.prop),
            unit = get_unit(from, opt.to);
        if (unit && from.toString().indexOf(unit) < 0) {
            from = 0;
        }
        opt._current_from = from; // for pause or reverse
        var current = parseFloat(from),
            rid = opt.delay && ('_oz_anim_' + render_id++);
        mainloop.addTween(name, current, end, opt.duration, {
            easing: opt.easing,
            delay: opt.delay,
            step: function(v){
                set_style_prop(elm, opt.prop, v + unit);
            },
            renderId: rid,
            callback: function(){
                opt._promise.resolve([{
                    target: elm,
                    succ: true
                }]).disable();
            }
        });
        opt._render = mainloop.getRender(rid);
    }

    function split_transform(value, fn){
        var to_lib = parse_transform(value);
        return Object.keys(to_lib).map(function(prop){
            return fn({
                prop: prop,
                to: this[prop]
            });
        }, to_lib);
    }

    function parse_transform(value){
        var lib = {};
        value.split(RE_PROP_SPLIT).forEach(function(str){
            var kv = str.match(/([^\(\)]+)/g),
                values = kv[1].split(/\,\s*/),
                isSupported = TRANSFORM_PROPS[kv[0]],
                is3D = isSupported === 3,
                isSingle = isSupported < 0 || values.length <= 1,
                xyz = isSingle ? [''] : ['X', 'Y', 'Z'];
            if (!isSupported) {
                return;
            }
            values.forEach(function(v, i){
                if (v && i <= xyz.length && is3D || isSingle && i < 1 || !isSingle && i < 2) {
                    var k = kv[0].replace('3d', '') + xyz[i];
                    this[k] = v;
                }
            }, this);
        }, lib);
        return lib;
    }

    function elm2hash(elm){
        var hash = elm._oz_fx;
        if (!hash) {
            hash = ++hash_id;
            elm._oz_fx = hash;
            elm.removeEventListener(TRANSIT_EVENT, when_transition_end);
            elm.addEventListener(TRANSIT_EVENT, when_transition_end);
        }
        if (!_transition_sets[hash]) {
            _transition_sets[hash] = {};
        }
        return hash;
    }

    function when_transition_end(e){
        var self = this,
            hash = this._oz_fx,
            sets = _transition_sets[hash];
        if (sets) {
            if (e.propertyName === TRANSFORM) { 
                for (var i in TRANSFORM_PROPS) {
                    delete sets[i];
                }
                var promises = _transform_promise[hash] || [];
                this.style[TRANSITION_METHOD] = transitionStr(hash);
                promises.forEach(function(promise){
                    promise.resolve([{
                        target: self,
                        succ: true
                    }]).disable();
                }); 
            } else {
                var opt = sets[e.propertyName];
                if (opt) {
                    delete sets[opt.prop];
                    this.style[TRANSITION_METHOD] = transitionStr(hash);
                    if (opt._promise) {
                        opt._promise.resolve([{
                            target: this,
                            succ: true
                        }]).disable();
                    }
                }
            }
        }
    }

    function get_style_value(node, name){
        if (TRANSFORM_PROPS[name]) {
            return transform(node, name) || 0;
        }
        if (name === TRANSFORM) {
            return node && node.style[
                TRANSFORM_METHOD || name
            ] || TRANSFORM_DEFAULT;
        }
        var method = css_method(name);
        var r = node && (node.style[method] 
            || (_getComputedStyle 
                ? _getComputedStyle(node, '').getPropertyValue(name)
                : node.currentStyle[name]));
        return (r && /\d/.test(r)) && r || 0;
    }

    function set_style_prop(elm, prop, v){
        if (TRANSFORM_PROPS[prop]) {
            if (TRANSFORM) {
                transform(elm, prop, v);
            }
        } else {
            elm.style[css_method(prop)] = v;
        }
    }

    function transform(elm, prop, v){
        var current = parse_transform(get_style_value(elm, TRANSFORM));
        if (v) {
            var kv = parse_transform(prop + '(' + v + ')');
            _.mix(current, kv);
            elm.style[TRANSFORM_METHOD] = Object.keys(current).map(function(prop){
                return prop + '(' + this[prop] + ')';
            }, current).join(' ');
        } else {
            return current[prop] || prop === 'rotate' && '0deg';
        }
    }

    function transitionStr(hash){
        var sets = _transition_sets[hash];
        if (sets) {
            var str = [], opt;
            for (var prop in sets) {
                opt = sets[prop];
                if (opt && opt.prop) {
                    str.push([
                        TRANSFORM_PROPS[opt.prop] && TRANSFORM || opt.prop,
                        (opt.duration || 0) + 'ms',
                        timing_values[opt.easing] || 'linear',
                        (opt.delay || 0) + 'ms'
                    ].join(' '));
                }
            }
            return str.join(",");
        } else {
            return '';
        }
    }

    function get_unit(from, to){
        var from_unit = (from || '').toString().replace(RE_UNIT, ''),
            to_unit = (to || '').toString().replace(RE_UNIT, '');
        return parseFloat(from) === 0 && to_unit 
            || parseFloat(to) === 0 && from_unit 
            || to_unit || from_unit;
    }

    function css_method(name){
        return name.replace(/-+(.)?/g, function($0, $1){
            return $1 ? $1.toUpperCase() : '';
        }); 
    }

    function clear_member(array, member){
        var n = array.indexOf(member);
        if (n !== -1) {
            array.splice(n, 1);
        }
    }

    function promise_proxy(target){
        var transform_promise;
        if (useCSS) {
            transform_promise = new Event.Promise();
            var hash = elm2hash(target);
            if (!_transform_promise[hash]) {
                _transform_promise[hash] = [];
            }
            _transform_promise[hash].push(transform_promise);
        }
        return transform_promise;
    }

    function actor_opts(actor){
        if (actor.members) {
            // convert from Actor Group to original Transform Actor 
            var eg = actor.members[0]._opt;
            if (!TRANSFORM_PROPS[eg.prop]) {
                return actor.members.map(function(sub){
                    return actor_opts(sub);
                });
            } else {
                var opt = actor._opt = _.copy(eg);
                opt.prop = TRANSFORM;
                opt.to = actor.members.map(function(actor){
                    return actor._opt.prop + '(' + actor._opt.to + ')';
                }).join(' ');
                delete opt._parent;
            }
        }
        return actor._opt;
    }

    function actor_setter(actor, v, fn){
        var opt = actor._opt, 
            stage = actor.stage;
        if (stage && !stage.isCompleted()) {
            stage.cancel();
        }
        if (actor.members) {
            if (typeof v === 'string' 
                && TRANSFORM_PROPS[actor.members[0]._opt.prop]) {
                var lib = {};
                split_transform(v, function(sub_opt){
                    lib[sub_opt.prop] = sub_opt.to;
                });
                v = lib;
            }
            actor.members.forEach(function(actor){
                var mem_opt = actor._opt;
                mem_opt.to = fn(mem_opt, this[mem_opt.prop]);
            }, v);
        } else {
            opt.to = fn(actor._opt, v);
        }
        return actor;
    }

    function exports(name){
        return new Stage(name);
    }

    _.mix(exports, {

        VERSION: '1.0.1',
        renderMode: useCSS ? 'css' : 'js',
        Stage: Stage,
        Actor: Actor,

        config: function(opt){
            if (opt.easing) {
                _.mix(timing_values, opt.easing.values);
                _.mix(timing_functions, opt.easing.functions);
                mainloop.config({ easing: timing_functions });
            }
            if (/(js|css)/.test(opt.renderMode)) {
                useCSS = opt.renderMode === 'css';
                this.renderMode = opt.renderMode;
            }
        },

        transform: transform

    });

    return exports;

});

/* @source soviet.js */;

/**
 * SovietJS
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
            var table = this.events[event];
            if (table) {
                _accessor.call(this, table, selector,
                    handler, _remove_handler);
            }
            return this;
        },

        matches: function(event, selector){
            var table = this.events[event];
            return _accessor.call(this, table, selector,
                null, _get_handler);
        },

        reset: function(event){
            if (event) {
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

/* @source ../cardkit/view.js */;

define("../cardkit/view", [
  "dollar",
  "mo/lang",
  "mo/template",
  "soviet",
  "choreo",
  "moui/gesture/base",
  "moui/gesture/tap",
  "moui/gesture/swipe",
  "moui/gesture/drag",
  "moui/gesture/scroll",
  "../cardkit/bus",
  "../cardkit/pagesession",
  "../cardkit/view/parser",
  "../cardkit/view/modal",
  "mo/domready"
], function($, _, tpl, soviet, choreo, 
    baseGeste, tapGeste, swipeGeste, dragGeste, scrollGeste, 
    bus, pageSession, htmlparser, modal){

    var window = this,
        location = window.location,
        document = window.document,
        body = document.body,

        SUPPORT_ORIENT = "orientation" in window && "onorientationchange" in window,
        SUPPORT_OVERFLOWSCROLL = "overflowScrolling" in body;

    _.mix(baseGeste.GestureBase.prototype, {
        bind: function(ev, handler){
            $(this.node).bind(ev, handler);
            return this;
        },
        unbind: function(ev, handler){
            $(this.node).unbind(ev, handler);
            return this;
        },
        trigger: function(e, ev){
            $(e.target).trigger(ev);
            return this;
        }
    });

    var tap_events = {

        'a': link_handler,
        'a *': link_handler,

        '.ck-modal': function(e){
            var me = $(this),
                json_url = me.data('jsonUrl'),
                target_id = me.data('target');
            view.openModal({
                title: me.data('title'),
                content: target_id ? $('#' + target_id).html() : undefined,
                url: me.data('url') || json_url,
                urlType: json_url && 'json'
            });
        }
    
    };

    modal.event.bind('open', function(modal){
        var wph = window.innerHeight - 50,
            h = Math.round(wph - view.headerHeight);
        view.disableView = true;
        view.showTopbar();
        modal._wrapper.css('marginTop', wph + 'px');
        modal._content.css('height', h + 'px');
        choreo.transform(modal._wrapper[0], 'translateY', 0 - wph + 'px');
        choreo.transform(view.header.parent()[0], 'scale', 0.75);
        choreo.transform(view.header.parent()[0], 'translateY', '10px');
    });

    var view = {

        init: function(opt){
            var wrapper = this.wrapper = opt.wrapper;
            this.header = opt.header,
            this.footer = $('.ck-footer', wrapper);
            this.loadingCard = $('#ckLoading');
            this.defaultCard = $('#ckDefault');
            this.headerHeight = this.header.height();
            this.windowFullHeight = Infinity;

            this.render();
            this.showTopbar();
            this.initState();

            $(window).bind('resize', function(e){
                view.updateSize();
            });

            this.hideAddressbar();
            this.windowFullHeight = window.innerHeight;

            tapGeste(document, {});
            scrollGeste(document, {});

            soviet(document, {
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': nothing,
                'a *': nothing
            }).on('tap', tap_events);

            $(document).bind('scrolldown', function(e){
                view.hideAddressbar();
                if (view.viewport[0].scrollTop >= view.headerHeight) {
                    view.hideTopbar();
                }
            }).bind('scrollup', function(e){
                view.showTopbar();
            });

        },

        render: function(){
            htmlparser(this.wrapper);
            this.loadingCard.hide();
            this.footer.show();
        },

        initState: function(){

            $(window).bind("popstate", function(e){
                var loading = view.viewport[0].id === 'ckLoading';
                //alert(['pop', 
                 //e.state && [e.state.prev, e.state.next], 
                 //view.viewport && view.viewport[0].id].join(', '))
                if (e.state) {
                    if (e.state.next === '_modal_') {
                        modal.set(e.state.opt).open();
                    } else if (modal.opened) {
                        view.closeModal();
                    } else if (e.state.next === 'ckLoading' && loading) {
                        // back from other page
                        history.back();
                    } else if (loading) {
                        // from other page, need hide loading immediately
                        view.showTopbar();
                        view.changeView(e.state.next);
                        view.loadingCard.hide();
                    } else if (e.state.prev === view.viewport[0].id) {
                        // forward from inner view
                        link_handler(e.state.next, e.state.link);
                    } else {
                        // back from inner view
                        back_handler(e.state.next);
                    }
                } else if (loading) {
                    // forward from other page, need restore (cache mod)
                    history.forward();
                } else { 
                    // back to other page, need show loading first
                    back_handler('ckLoading');
                }
            });

            pageSession.init();

            var current_state = history.state,
                restore_state = current_state && current_state.next;
            //alert(['init', 
             //current_state && [current_state.prev, current_state.next], 
             //view.viewport && view.viewport[0].id].join(', '))
            if (restore_state === '_modal_') { // @TODO
                restore_state = current_state.prev;
                modal.set(history.state.opt).open();
            }
            if (restore_state) {
                view.changeView(restore_state);
                if (restore_state === 'ckLoading') {
                    history.back();
                }
            } else {
                if (pageSession.indexOf(location.href) !== -1) {
                    view.changeView(view.loadingCard);
                    history.forward();
                } else {
                    view.changeView(view.defaultCard);
                    push_history(view.loadingCard[0].id, view.defaultCard[0].id);
                    pageSession.push(location.href);
                }
            }

        },

        changeView: function(card){
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            this.viewport = card.show();
            card.append(this.footer);
            this.updateSize();
            //card[0].scrollTop = this.topbarEnable ? 0 : this.headerHeight;
        },

        updateSize: function(){
            this.viewport[0].style.height = window.innerHeight + 'px';
        },

        hideTopbar: function(){
            if (this.topbarEnable && !this.disableView) {
                this.topbarEnable = false;
                choreo.transform(view.header[0], 'translateY', '-' + this.headerHeight + 'px');
            }
        },

        showTopbar: function(){
            if (!this.topbarEnable) {
                this.topbarEnable = true;
                choreo.transform(view.header[0], 'translateY', '0');
            }
        },

        hideAddressbar: function(){
            if (this.windowFullHeight > window.innerHeight) {
                body.style.height = screen.availHeight + 'px';
                window.scrollTo(0, 1);
                view.updateSize();
                body.style.height = '';
            }
        },

        //showAddressbar: function(){
            //setTimeout(function() {
                //window.scrollTo(0, 0);
                //view.updateSize();
            //}, 0);
        //},

        //getOrientation : function() {
            //var is_portrait = true;
            //if (SUPPORT_ORIENT) {
                //is_portrait = ({ "0": true, "180": true })[window.orientation];
            //} else {
                //is_portrait = body.clientWidth / body.clientHeight < 1.1;
            //}

            //return is_portrait ? "portrait" : "landscape";
        //},

        openModal: function(opt){
            if (!modal.opened) {
                push_history(view.viewport[0].id, '_modal_', false, opt);
            }
            modal.set(opt).open();
        },

        closeModal: function(){
            view.disableView = false;
            choreo.transform(modal._wrapper[0], 'translateY', '0');
            choreo.transform(view.header.parent()[0], 'scale', 1);
            choreo.transform(view.header.parent()[0], 'translateY', '0');
            setTimeout(function(){
                modal.close();
            }, 400);
        },

        modal: modal

    };

    function nothing(){}

    function link_handler(next_id, true_link){
        var me, is_forward = typeof next_id === 'string';
        if (!is_forward) {
            me = next_id.target;
            next_id = '';
            while (!me.href) {
                me = me.parentNode;
            }
            if ($(me).hasClass('ck-link')) {
                next_id = (me.href.replace(location.href, '')
                    .match(/^#(.+)/) || [])[1];
            }
        }
        var next = next_id && $('#' + next_id);
        if (!next) {
            if (me) {
                next_id = 'ckLoading';
                next = view.loadingCard;
                true_link = me.href;
                pageSession.clear(pageSession.indexOf(location.href));
            } else {
                return;
            }
        }
        var current = view.viewport;
        if (!is_forward) {
            push_history(current[0].id, next_id, true_link);
        }
        view.showTopbar();
        view.changeView(next);
        next.addClass('moving');
        choreo().play().actor(view.wrapper[0], {
            'transform': 'translateX(' + (0 - window.innerWidth) + 'px)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide();
            choreo.transform(view.wrapper[0], 'translateX', '0');
            next.removeClass('moving');
            if (true_link) {
                if (is_forward) {
                    history.forward();
                } else {
                    location.href = true_link;
                }
            }
            //view.hideTopbar();
        });
    }

    function back_handler(prev_id){
        var prev = $('#' + prev_id);
        var current = view.viewport;
        view.showTopbar();
        view.changeView(prev);
        choreo.transform(view.wrapper[0], 'translateX', 0 - window.innerWidth + 'px');
        current.addClass('moving');
        prev.show();
        choreo().play().actor(view.wrapper[0], {
            'transform': 'translateX(0)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide().removeClass('moving');
            if (prev_id === 'ckLoading') {
                history.back();
            }
            //view.hideTopbar();
        });
    }

    function push_history(prev_id, next_id, link, opt){
        history.pushState({
            prev: prev_id,
            next: next_id,
            link: link,
            opt: opt,
            i: history.length
        }, document.title, location.href);
    }

    return view;

});

/* @source ../cardkit/app.js */;

define("../cardkit/app", [
  "mo/lang",
  "../cardkit/bus",
  "../cardkit/view"
], function(_, bus, view){

    var app = {

        setup: function(opt){

            view.init(opt);

        }
    
    };

    return app;

});

/* @source  */;


require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'tpl': '../tpl/',
        'cardkit': '../cardkit/'
    }
});

define('mo/lang/es5', [], function(){});
define('mo/mainloop', [], function(){});

require([
    'dollar', 
    'cardkit/app'
], function($, app){

    app.setup({
        header: $('.ck-header'),
        wrapper: $('.ck-wrapper')
    });

});
