
/* @source lib/oz.js */;

/**
 * OzJS: microkernel for modular javascript 
 * compatible with CommonJS Asynchronous Modules
 * Copyright (C) 2010-1011, Dexter.Yy
 * Licensed under The MIT License
 * @example https://github.com/dexteryy/OzJS/tree/master/tests
 * vim:set ts=4 sw=4 sts=4 et:
 */ 
(function(undefined){

var window = this,
    _toString = Object.prototype.toString,
    _RE_PLUGIN = /(.*)!(.+)/,
    _RE_DEPS = /\Wrequire\((['"]).+?\1\)/g,
    _RE_SUFFIX = /\.(js|json)$/,
    _builtin_mods = { "require": 1, "exports": 1, "module": 1, "host": 1, "finish": 1 },

    _muid = 0,
    _config = {
        mods: {}
    },
    _scripts = {},
    _delays = {},
    _refers = {},
    _waitings = {},
    _latestMod,
    _resets = {},

    forEach = Array.prototype.forEach || function(fn, sc){
        for(var i = 0, l = this.length; i < l; i++){
            if (i in this)
                fn.call(sc, this[i], i, this);
        }
    };

function isFunction(obj) {
    return _toString.call(obj) === "[object Function]";
}

function isArray(obj) {
    return _toString.call(obj) === "[object Array]";
}

function isWindow(obj) {
    return "setInterval" in obj;
}

function clone(obj) {
    function NewObj(){}
    NewObj.prototype = obj;
    return new NewObj();
}

/**
 * @public compare version number (Semantic Versioning format)
 * @param {string}
 * @param {string}
 * @return {boolean} v1 >= v2 == true
 */ 
function semver(v1, v2){
    v1 = v1.split('.');
    v2 = v2.split('.');
    var result, l = v1.length;
    if (v2.length > l)
        l = v2.length;
    for (var i = 0; i < l; i++) {
        result = (v1[i] || 0) - (v2[i] || 0);
        if (result === 0)
            continue;
        else
            break;
    }
    return result >= 0;
}

/**
 * @public define / register a module and its meta information
 * @param {string} module name. optional as unique module in a script file
 * @param {string[]} dependencies. optional
 * @param {function} module code, execute only once on the first call 
 *
 * @note
 *
 * define('', [""], func)
 * define('', [""], "")
 *
 * define('', [""])
 * define('', "")
 *
 * define('', func)
 * define([""], func)
 * define(func)
 */ 
function define(fullname, deps, block){
    var is_remote = typeof block === 'string';
    if (!block) {
        if (deps) {
            if (isArray(deps)) {
                block = autoname(fullname);
            } else {
                block = deps;
                deps = null;
            }
        } else {
            block = fullname;
            fullname = "";
        }
        if (typeof fullname !== 'string') {
            deps = fullname;
            fullname = "";
        } else {
            is_remote = typeof block === 'string';
            if (!is_remote && !deps) {
                deps = seek(block);
            }
        }
    }
    var mod = fullname && _config.mods[fullname];
    if (mod && mod.fullname 
            && (is_remote && mod.loaded == 2 || mod.exports)) {
        return;
    }
    if (is_remote && _config.enable_ozma) {
        deps = null;
    }
    var name = fullname.split('@'),
        host = isWindow(this) ? this : window,
        ver = name[1];
    name = name[0];
    mod = _config.mods[fullname] = {
        name: name,
        fullname: fullname,
        id: ++_muid,
        version: ver,
        url: mod && mod.url,
        host: host,
        deps: deps || []
    };
    if (fullname === "") { // capture anonymous module
        _latestMod = mod;
    }
    if (typeof block !== 'string') {
        mod.block = block;
        mod.loaded = 2;
    } else { // remote module
        mod.url = block;
    }
    if (mod.block && !isFunction(mod.block)) { // json module
        mod.exports = block;
    }
    if (name !== fullname) { // compare version number, link to the newest version
        var current = _config.mods[name];
        if (!current ||
                !current.block && (!current.url || current.loaded) ||
                current.version && semver(ver, current.version)) {
            _config.mods[name] = mod;
        }
    }
}

/**
 * @public run a code block its dependencies 
 * @param {string[]} [module fullname] dependencies
 * @param {function}
 */ 
function require(deps, block) {
    if (!block) {
        block = deps;
        deps = seek(block);
    } else if (typeof deps === 'string') {
        deps = [deps];
    }
    var m, remotes = 0, // counter for remote scripts
        host = isWindow(this) ? this : window,
        list = scan.call(host, deps);  // calculate dependencies, find all required modules
    for (var i = 0, l = list.length; i < l; i++) {
        m = list[i];
        if (m.is_reset) {
            m = _config.mods[m.fullname];
        }
        if (m.url && m.loaded !== 2) { // remote module
            remotes++;
            m.loaded = 1; // status: loading
            fetch(m, function(){
                this.loaded = 2; // status: loaded 
                var lm = _latestMod;
                if (lm) { // capture anonymous module
                    lm.name = this.name;
                    lm.fullname = this.fullname;
                    lm.version = this.version;
                    lm.url = this.url;
                    var mods = _config.mods;
                    mods[lm.fullname] = lm;
                    if (mods[lm.name] && mods[lm.name].fullname === lm.fullname) {
                        mods[lm.name] = lm;
                    }
                    _latestMod = null;
                }
                // loaded all modules, calculate dependencies all over again
                if (--remotes <= 0) {
                    require.call(host, deps, block);
                }
            });
        }
    }
    if (!remotes) {
        list.push({
            deps: deps,
            host: host,
            block: block
        });
        setTimeout(function(){
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
        depObjs, exportObj, rmod,
        wt = _waitings;
    while (mod = list.pop()) {
        if (mod.is_reset) {
            rmod = clone(_config.mods[mod.fullname]);
            rmod.host = mod.host;
            rmod.newname = mod.newname;
            mod = rmod;
            if (!_resets[mod.newname]) {
                _resets[mod.newname] = [];
            }
            _resets[mod.newname].push(mod);
            mod.exports = undefined;
        } else if (mod.fullname) {
            mod = _config.mods[mod.fullname] || mod;
        }
        if (!mod.block || !mod.running && mod.exports !== undefined) {
            continue;
        }
        depObjs = [];
        exportObj = {}; // for "exports" module
        deps = mod.deps.slice();
        deps[mod.block.hiddenDeps ? 'unshift' : 'push']("require", "exports", "module");
        for (var i = 0, l = deps.length; i < l; i++) {
            mid = deps[i];
            switch(mid) {
                case 'require':
                    depObjs.push(requireFn);
                    break;
                case 'exports':
                    depObjs.push(exportObj);
                    break;
                case 'module':
                    depObjs.push(mod);
                    break;
                case 'host':
                    depObjs.push(mod.host);
                    break;
                case 'finish':  // execute asynchronously
                    tid = mod.fullname;
                    if (!wt[tid]) // for delay execute
                        wt[tid] = [list];
                    else
                        wt[tid].push(list);
                    depObjs.push(function(result){
                        // HACK: no guarantee that this function will be invoked after while() loop termination in Chrome/Safari 
                        setTimeout(function(){
                            // 'mod' equal to 'list[list.length-1]'
                            if (result) {
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
                        || _config.mods[mid] 
                        || {}
                    ).exports);
                    break;
            }
        }
        if (!mod.running) {
            // execute module code. arguments: [dep1, dep2, ..., require, exports, module]
            result = mod.block.apply(oz, depObjs) || null;
            mod.exports = result || exportObj; // use empty exportObj for "finish"
            for (var v in exportObj) {
                if (v) {
                    mod.exports = exportObj;
                }
                break;
            }
            //console.log(mod.fullname, mod.exports)
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
        var mname = m.fullname, delays = _delays;
        if (m.deps && m.deps.length && delays[mname] !== 1) {
            delays[mname] = [m.deps.length, cb];
            m.deps.forEach(function(dep){
                var d = _config.mods[dep];
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
        var alias = _config.aliases;
        if (alias) {
            url = url.replace(/\{(\w+)\}/g, function(e1, e2){
                return alias[e2] || "";
            });
        }
        var true_url = /^http:\/\//.test(url) ? url 
                : (_config.enable_ozma && _config.distUrl || _config.baseUrl || '') 
                    + (_config.enableAutoSuffix ? truename(url) : url);
        getScript.call(m.host || this, true_url, function(){
            forEach.call(observers, function(args){
                args[0].call(args[1]);
            });
            _scripts[url] = 1;
            if (_refers[mname] && _refers[mname] !== 1) {
                _refers[mname].forEach(function(dm){
                    var b = this[dm.fullname];
                    if (--b[0] <= 0) {
                        this[dm.fullname] = 1;
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
 * @param {object[]} a sequence of modules, for recursion
 * @return {object[]} a sequence of modules
 */ 
function scan(m, list){
    list = list || [];
    if (!m[0]) {
        return list;
    }
    var history = list.history;
    if (!history) {
        history = list.history = {};
    }
    var deps, dep, mid, plugin, truename;
    if (m[1]) {
        deps = m;
        m = false;
    } else {
        mid = m[0];
        plugin = _RE_PLUGIN.exec(mid);
        if (plugin) {
            mid = plugin[2];
            plugin = plugin[1];
        }
        if (!_config.mods[mid] && !_builtin_mods[mid]) {
            define(mid, autoname(mid));
        }
        m = _config.mods[mid];
        if (m) {
            if (plugin === "new") {
                m = {
                    is_reset: true,
                    deps: m.deps,
                    fullname: mid,
                    newname: plugin + "!" + mid,
                    host: this
                };
            } else {
                truename = m.fullname;
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
            scan.call(this, [deps[i]], list);
        }
    }
    if (m) {
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

function autoname(mid){
    var ver = mid.split('@');
    if (_RE_SUFFIX.test(ver[0])) {
        ver = ver[1] ? ver[0].replace(_RE_SUFFIX, function($0){ return '-' + ver[1] + $0; }) : ver[0];
    } else {
        ver = (ver[1] ? (ver[0] + '-' + ver[1]) : ver[0]) + '.js';
    }
    return ver;
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
function truename(file){
    return file.replace(/(.+?)(_src.*)?(\.\w+)$/, function($0, $1, $2, $3){
        return $1 + ($2 && '_combo' || '_pack') + $3;
    });
}

/**
 * @private for "require" module
 */ 
function requireFn(name, cb){
    if (!cb) {
        return (_config.mods[name] || {}).exports;
    } else {
        return require(name, cb);
    }
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

function config(opt){
    for (var i in opt) {
        if (i === 'aliases') {
            if (!_config[i]) {
                _config[i] = {};
            }
            for (var j in opt[i]) {
                _config[i][j] = opt[i][j];
            }
        } else {
            _config[i] = opt[i];
        }
    }
}

var oz = {
    define: define,
    require: require,
    config: config,
    seek: seek,
    fetch: fetch,
    autoname: autoname,
    truename: truename,
    // non-core
    _semver: semver,
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


/* @source mod/lang.js */;

/**
 * Copyright (C) 2011, Dexter.Yy, MIT License
 */
define("mod/lang", ["host"], function(host, require, exports){

    var oz = this,
        Array = host.Array,
        String = host.String,
        Object = host.Object,
        Function = host.Function,
        window = host.window,
        _toString = Object.prototype.toString,
        _aproto = Array.prototype;

    if (!_aproto.filter) {
        _aproto.filter = function(fn, sc){
            var r = [];
            for (var i = 0, l = this.length; i < l; i++){
                if (i in this && fn.call(sc, this[i], i, this)) {
                    r.push(this[i]);
                }
            }
            return r;
        };
    }
        
    if (!_aproto.forEach) {
        _aproto.forEach = oz._forEach;
    }

    if (!_aproto.map) {
        _aproto.map = function(fn, sc){
            for (var i = 0, copy = [], l = this.length; i < l; i++) {
                if (i in this) {
                    copy[i] = fn.call(sc, this[i], i, this);
                }
            }
            return copy;
        };
    }

    if (!_aproto.reduce) {
        _aproto.reduce = function(fn, sc){
            for (var i = 1, prev = this[0], l = this.length; i < l; i++) {
                if (i in this) {
                    prev = fn.call(sc, prev, this[i], i, this);
                }
            }
            return prev;
        };
    }

    if (!_aproto.some) {
        _aproto.some = function(fn, sc){
            for (var i = 0, l = this.length; i < l; i++){
                if (i in this && fn.call(sc, this[i], i, this)) {
                    return true;
                }
            }
            return false;
        };
    }

    if (!_aproto.every) {
        _aproto.every = function(fn, sc){
            for (var i = 0, l = this.length; i < l; i++){
                if (i in this && !fn.call(sc, this[i], i, this)) {
                    return false;
                }
            }
            return true;
        };
    }

    if (!_aproto.indexOf) {
        _aproto.indexOf = function(elt, from){
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

    if (!_aproto.lastIndexOf) {
        _aproto.lastIndexOf = function(elt, from){
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
            return exports.type(obj) === "array";
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
        String.prototype.trim = function(text) {
            return text == null ?  "" : text.toString().replace(trimLeft, "").replace(trimRight, "");
        };
    }

    if (!Object.keys) {
        Object.keys = function(obj) {
            var keys = [];
            for (var prop in obj) {
                if ( obj.hasOwnProperty(prop) ) {
                    keys.push(prop);
                }
            }
            return keys;
        };
    }

    if (!Object.create) {
        Object.create = oz._clone;
    }

    if (!Object.getPrototypeOf) {
        Object.getPrototypeOf = function (obj) {
            return obj.__proto__ || obj.constructor.prototype;
        };
    }
    

    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            var aArgs = Array.prototype.slice.call(arguments, 1), 
                fToBind = this, 
                fBound = function () {
                    return fToBind.apply(this instanceof fBound ? this : oThis || window, 
                        aArgs.concat(Array.prototype.slice.call(arguments)));    
                };
            fBound.prototype = Object.create(this.prototype);
            return fBound;
        };
    }
    
    var _typeMap = {};
    _aproto.forEach.call("Boolean Number String Function Array Date RegExp Object".split(" "), function(name , i){
        this[ "[object " + name + "]" ] = name.toLowerCase();
    }, _typeMap);

    function type(obj) {
        return obj == null ?
            String(obj) :
            _typeMap[ _toString.call(obj) ] || "object";
    }

    exports.type = type;
    exports.isFunction = oz._isFunction;
    exports.isWindow = oz._isWindow;
    exports.semver = oz._semver;

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

    exports.FnQueue = exports.fnQueue = function(){
        var queue = [], dup = false;
        function getCallMethod(type){
            return function(){
                var re, fn;
                for (var i = 0, l = this.length; i < l; i++) {
                    fn = this[i];
                    if (fn) {
                        re = fn[type].apply(fn, arguments);
                    } else {
                        break;
                    }
                }
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

/* @source mod/event.js */;

/**
 * Copyright (C) 2011, Dexter.Yy, MIT License
 */
define("mod/event", ["mod/lang"], function(_){

    var fnQueue = _.fnQueue,
        slice = Array.prototype.slice;

    function Promise(opt){
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
    }

    var actors = Promise.prototype = {

        then: function(handler, errorHandler){
            var _status = this.status;
            if (errorHandler) {
                if (_status === 2) {
                    this._resultCache = errorHandler.apply(this, this._argsCache);
                } else if (!_status) {
                    this.failHandlers.push(errorHandler);
                    this._lastFailQueue = this.failHandlers;
                }
            } else {
                this._lastFailQueue = [];
            }
            if (handler) {
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

        done: function(handler){
            return this.then(handler);
        },

        fail: function(handler){
            return this.then(false, handler);
        },

        cancel: function(handler, errorHandler){
            if (handler) {
                this.doneHandlers.clear(handler);
            }
            if (errorHandler) {
                this.failHandlers.clear(errorHandler);
            }
            return this;            
        },

        bind: function(handler){
            if (this.status) {
                handler.apply(this, this._argsCache);
            }
            this.observeHandlers.push(handler);
            return this;
        },

        unbind: function(handler){
            this.observeHandlers.clear(handler);
            return this;            
        },

        fire: function(params){
            if (this.trace) {
                this._trace();
            }
            params = params || [];
            var onceHandlers = this.doneHandlers;
            this.doneHandlers = this._alterQueue;
            this.observeHandlers.apply(this, params);
            onceHandlers.apply(this, params);
            onceHandlers.length = 0;
            this._alterQueue = onceHandlers;
            return this;
        },

        error: function(params){
            if (this.trace) {
                this._trace();
            }
            params = params || [];
            var onceHandlers = this.failHandlers;
            this.failHandlers = this._alterQueue;
            this.observeHandlers.apply(this, params);
            onceHandlers.apply(this, params); 
            onceHandlers.length = 0;
            this._alterQueue = onceHandlers;
            return this;
        },

        resolve: function(params){
            this.status = 1;
            this._argsCache = params || [];
            return this.fire(params);
        },

        reject: function(params){
            this.status = 2;
            this._argsCache = params || [];
            return this.error(params);
        },

        reset: function(){
            this.status = 0;
            this._argsCache = [];
            this.doneHandlers.length = 0;
            this.failHandlers.length = 0;
            return this;
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
            this._count = this._total;
            return this;
        },

        any: function(){
            this._count = 1;
            return this;
        },

        some: function(n){
            this._count = n;
            return this;
        }

    };

    actors.wait = actors.then;

    function when(){
        var mutiArgs = [],
            mutiPromise = new Promise();
        mutiPromise._count = mutiPromise._total = arguments.length;
        Array.prototype.forEach.call(arguments, function(promise, i){
            var mutiPromise = this;
            promise.then(callback, callback);
            function callback(params){
                mutiArgs[i] = params;
                if (--mutiPromise._count === 0) {
                    mutiPromise.resolve.call(mutiPromise, mutiArgs);
                }
            }
        }, mutiPromise);
        return mutiPromise;
    }

    function pipe(prev, next){
        if (prev && prev.then) {
            prev.then(function(){
                next.resolve(slice.call(arguments));
            }, function(){
                next.reject(slice.call(arguments));
            });
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

    Event.prototype = (function(methods){
        for (var i in actors) {
            methods[i] = dispatchFactory(i);
        }
        return methods;
    })({});

    Event.prototype.promise = function(subject){
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

    Event.prototype.when = function(){
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
    exports.when = when;

    return exports;
});

/* @source cardkits/bus.js */;

define("cardkits/bus", [
    'mod/event'
], function(Event){

    return Event();

});

/* @source mod/template.js */;

/**
 * Copyright (C) 2011, Dexter.Yy, MIT License
 */
define("mod/template", ["mod/lang", "host"], function(_, host, require, exports){

    var document = host.document;

    function escapeHTML(str){
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
    }

    /**
     * @public 按字节长度截取字符串
     * @param {string} str是包含中英文的字符串
     * @param {int} limit是长度限制（按英文字符的长度计算）
     * @param {function} cb返回的字符串会被方法返回
     * @return {string} 返回截取后的字符串,默认末尾带有"..."
     */
    function substr(str, limit, cb){
        if(!str || typeof str !== "string")
            return '';
        var sub = str.substr(0, limit).replace(/([^\x00-\xff])/g, '$1 ').substr(0, limit).replace(/([^\x00-\xff])\s/g, '$1');
        return cb ? cb.call(sub, sub) : (str.length > sub.length ? sub + '...' : sub);
    }


    exports.escapeHTML = escapeHTML;
    exports.substr = substr;

    exports.strsize = function(str){
        return str.replace(/([^\x00-\xff]|[A-Z])/g, '$1 ').length;
    };

    exports.str2html = function(str){
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

    exports.format = function(tpl, op){
        return tpl.replace(/\{\{(\w+)\}\}/g, function(e1,e2){
            return op[e2] != null ? op[e2] : "";
        });
    };

    // From Underscore.js 
    // JavaScript micro-templating, similar to John Resig's implementation.
    var tplSettings = {
        cache: {},
        evaluate: /\{%([\s\S]+?)%\}/g,
        interpolate: /\{%=([\s\S]+?)%\}/g
    };
    var tplMethods = {
        mix: _.mix,
        escapeHTML: escapeHTML,
        substr: substr,
        include: convertTpl,
        _has: function(obj){
            return function(name){
                return _.ns(name, undefined, obj);
            };
        }
    };
    function convertTpl(str, data, namespace){
        var func, c  = tplSettings, suffix = namespace ? '#' + namespace : '';
        if (!/[\t\r\n% ]/.test(str)) {
            func = c.cache[str + suffix];
            if (!func) {
                var tplbox = document.getElementById(str);
                if (tplbox) {
                    func = c.cache[str + suffix] = convertTpl(tplbox.innerHTML, false, namespace);
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
        return !func ? '' : (data ? func(data, tplMethods) : func);
    }

    exports.convertTpl = convertTpl;
    exports.reloadTpl = function(str){
        delete tplSettings.cache[str];
    };

});

/* @source mod/dollar.js */;


define("mod/dollar", [
    "mod/lang",
    "host"
], function(_, host){

    var doc = host.document,
        MATCHES_SELECTOR = ['webkitMatchesSelector', 'mozMatchesSelector', 'matchesSelector']
            .map(pluck, doc.body).filter(pick)[0],
        _array_each = Array.prototype.forEach,
        _array_push = Array.prototype.push;


    function $(selector, context){
        if (selector) {
            if (context) {
                return ext.find(context).find(selector);
            } else {
                return ext.find(selector);
            }
        }
    }

    $.prototype = Array.prototype;

    var ext = $.fn = _.mix($.prototype, {

        constructor: $,

        find: function(selector){
            if (selector.constructor === $) {
                return selector;
            }
            var obj = new $(), contexts;
            if (this === ext) {
                contexts = [doc];
            } else {
                obj.prevObject = contexts = this;
            }
            if (typeof selector === 'string') {
                if (/^#/.test(selector)) {
                    var elm = doc.getElementById(selector.substr(1));
                    if (elm) {
                        obj.push(elm);
                    }
                } else {
                    var query = /\W/.test(selector) ? 'querySelectorAll' 
                                                    : 'getElementsByTagName';
                    if (contexts[1]) {
                        contexts.forEach(function(context){
                            this.push.apply(this, context[query](selector));
                        }, obj);
                    } else {
                        obj.push.apply(obj, contexts[0][query](selector));
                    }
                }
            } else if (selector) {
                obj.push(selector);
            }
            return obj;
        },

        each: function(fn){
            for (var i = 0, l = this.length; i < l; i++){
                var re = fn.call(this[i], i);
                if (re === false) {
                    break;      
                }
            }
            return this;
        },

        end: function(){
            return this.prevObject || new $();
        },

        eq: function(i){
            return i === -1 ? this.slice(-1) : this.slice(i, i + 1);
        },

        not: function(selector){
            return this.filter(function(item){
                return item && !this(item, selector);
            }, matches_selector);
        },

        has: function(selector){
            return this.filter(function(item){
                return this(item, selector);
            }, matches_selector);
        },

        parent: function(selector){
            return _.unique([undefined, doc, null].concat(this.map(selector ? function(item){
                var p = item.parentNode;
                if (p && matches_selector(p, selector)) {
                    return p;
                }
            } : function(item){
                return item.parentNode;
            }))).slice(3);
        },

        parents: function(selector){
            var ancestors = new $(), p = this,
                finding = selector ? find_selector(selector, 'parentNode') : function(item){
                    return this[this.push(item.parentNode) - 1];
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

        siblings: function(selector){
            var sibs = new $(),
                finding = selector ? find_selector(selector) : function(item){
                    this.push(item);
                };
            this.forEach(function(item){
                _array_each.apply(((item || {}).parentNode || {}).children || [], function(child){
                    if (child !== item) {
                        this.call(this, child);
                    }
                }, this);
            }, sibs);
            return _.unique(sibs);
        },

        is: function(selector){
            this.some(function(item){
                return matches_selector(item, selector);
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

        addClass: function(cname){
            var is_fn_arg = _.isFunction(cname);
            this.forEach(function(item, i){
                if (is_fn_arg) {
                    cname = cname.call(this, i, item.className);
                }
                item.classList.add(cname);
            });
            return this;
        },

        removeClass: function(cname){
            var is_fn_arg = _.isFunction(cname);
            this.forEach(function(item, i){
                if (is_fn_arg) {
                    cname = cname.call(this, i, item.className);
                }
                item.classList.remove(cname);
            });
            return this;
        },

        toggleClass: function(cname, force){
            var is_fn_arg = _.isFunction(cname);
            this.forEach(function(item, i){
                if (is_fn_arg) {
                    cname = cname.call(this, i, item.className);
                }
                item.classList[typeof force === 'undefined' && 'toggle'
                                    || force && 'add' || 'remove'](cname);
            });
            return this;
        },

        css: function(){
        
        },

        attr: function(name, value){
        
        },

        removeAttr: function(){
        
        },

        prop: function(name, value){
        
        },

        html: function(){
        
        },

        text: function(){
        
        },

        val: function(){
        
        },

        offset: function(){
            var set = this[0].getBoundingClientRect();
            return {
                left: set.left + window.pageXOffset,
                top: set.top + window.pageYOffset,
                width: set.width,
                height: set.height
            };
        },

        appendTo: function(){
        
        },

        append: function(){
        
        },

        prependTo: function(){
        
        },

        prepend: function(){
        
        },

        insertBefore: function(){
        
        },

        insertAfter: function(){
        
        },

        bind: function(){
        
        },

        unbind: function(){
        
        }

    });

    function pluck(name){
        return this[name];
    }

    function pick(v){ 
        return v; 
    }

    function matches_selector(elm, selector){
        return elm && elm[MATCHES_SELECTOR](selector);
    }

    function find_selector(selector, attr){
        return function(item){
            if (attr) {
                item = item[attr];
            }
            if (matches_selector(item, selector)) {
                this.push(item);
            }
            return item;
        };
    }

    $.matchesSelector = matches_selector;

    return $;

});

/* @source cardkits/view.js */;

define("cardkits/view", [
    'mod/dollar',
    'mod/lang',
    'mod/template',
    'cardkits/bus'
], function($, _, tpl, bus){

    var view = {

        init: function(opt){

            var win = $(window),
                win_width = win.width();

            opt.viewport.css({
                'width': win_width,
                'overflow': 'auto'
            });

            opt.wrapper.css({
                'width': win_width * 15,
                'overflow': 'hidden'
            });

            opt.cards.css({
                'width': win_width,
                'height': 10000,
                'float': 'left',
                'overflow': 'hidden',
                'margin': 0
            });

            document.addEventListener("touchmove", function(e){
                //e.preventDefault();
            }, false);

        }
    
    };

    return view;

});

/* @source cardkits/app.js */;

define("cardkits/app", [
    'mod/lang',
    'cardkits/bus',
    'cardkits/view'
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
    baseUrl: 'js/',
    distUrl: 'dist/js/'
});

require([
    'mod/dollar', 
    'cardkits/app'
], function($, app){

    app.setup({
        viewport: $('.ck-viewport'),
        wrapper: $('.ck-wrapper'),
        cards: $('.ck-card')
    });

});
