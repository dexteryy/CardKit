/**
 * OzJS: microkernel for modular javascript 
 * compatible with AMD (Asynchronous Module Definition)
 * see http://dexteryy.github.com/OzJS/ for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
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
