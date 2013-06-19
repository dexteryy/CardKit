
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
var exec = function(list){
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
};

/**
 * @private observer for script loader, prevent duplicate requests
 * @param {object} module object
 * @param {function} callback
 */ 
var fetch = function(m, cb){
    var url = m.url,
        observers = _scripts[url];
    if (!observers) {
        var mname = m.name, delays = _delays;
        if (m.deps && m.deps.length && delays[mname] !== 1) {
            delays[mname] = [m.deps.length, cb];
            forEach.call(m.deps, function(dep){
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
                forEach.call(_refers[mname], function(dm){
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
};

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
    VERSION: '2.5.2',
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

    var match, skin, os, is_mobile,
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
            riphone = /(iphone) os ([\w._]+)/,
            ripad = /(ipad) os ([\w.]+)/,
            randroid = /(android)[ ;]([\w.]*)/,
            rmobilesafari = /(\w+)[ \/]([\w.]+)[ \/]mobile.*safari/,
            rsafari = /(\w+)[ \/]([\w.]+) safari/,
            rwebkit = /(webkit)[ \/]([\w.]+)/,
            ropera = /(opera)(?:.*version)?[ \/]([\w.]+)/,
            rmsie = /(msie) ([\w.]+)/,
            rmozilla = /(mozilla)(?:.*? rv:([\w.]+))?/;

        var r360se = /(360se)/,
            r360ee = /(360ee)/,
            r360phone = /(360) \w+phone/,
            rtheworld = /(theworld)/,
            rmaxthon3 = /(maxthon\/3)/,
            rmaxthon = /(maxthon)/,
            rwechat = /(micromessenger)/,
            rtt = /(tencenttraveler)/,
            rqq = /(qqbrowser)/,
            rbaidu = /(baidubrowser)/,
            ruc = /(ucbrowser)/,
            rmetasr = /(metasr)/;

        os = riphone.exec(ua) 
            || ripad.exec(ua) 
            || randroid.exec(ua) 
            || rmac.exec(ua) 
            || rwindows.exec(ua) 
            || [];

        match =  rwebkit.exec(ua) 
            || ropera.exec(ua) 
            || rmsie.exec(ua) 
            || ua.indexOf("compatible") < 0 && rmozilla.exec(ua) 
            || [];

        is_mobile = rmobilesafari.exec(ua);

        if (match[1] === 'webkit') {
            var vendor = is_mobile || rsafari.exec(ua);
            if (vendor) {
                match[3] = match[1];
                match[4] = match[2];
                match[1] = vendor[1] === 'version' 
                    && ((os[1] === 'iphone' 
                            || os[1] === 'ipad')
                            && 'mobilesafari'
                        || os[1] === 'android' 
                            && 'aosp' 
                        || 'safari')
                    || vendor[1];
                match[2] = vendor[2];
            }
        }

        skin = r360se.exec(ua) 
            || r360ee.exec(ua) 
            || r360phone.exec(ua) 
            || ruc.exec(ua) 
            || rtheworld.exec(ua) 
            || rmaxthon3.exec(ua) 
            || rmaxthon.exec(ua) 
            || rwechat.exec(ua)
            || rtt.exec(ua) 
            || rqq.exec(ua) 
            || rbaidu.exec(ua) 
            || rmetasr.exec(ua) 
            || [];

    } catch (ex) {
        match = [];
        skin = [];
    }

    var result = { 
        browser: match[1] || "", 
        version: match[2] || "0",
        engine: match[3],
        engineversion: match[4] || "0",
        os: os[1],
        osversion: os[2] || "0",
        isMobile: os[1] === 'iphone'
            || os[1] === 'android' && !!is_mobile,
        skin: skin[1] || "",
        ua: ua
    };

    if (result.os === 'android' && !result.browser) {
        result.skin = 'ucbrowser';
        result.browser = 'aosp';
        result.engine = 'webkit';
        result.osversion = "0";
    }

    if (match[1]) {
        result[match[1]] = parseInt(result.version, 10) || true;
    }
    if (skin[1]) {
        result.rank = rank[result.skin] || 0;
    }
    result.shell = result.skin;

    return result;

});

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
        _fnproto = Function.prototype,
        _toString = _objproto.toString;

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
            return _toString.call(obj) === "[object Array]";
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
        return "setInterval" in obj;
    };

	exports.isEmptyObject = function(obj) {
        for (var name in obj) {
            name = null;
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
        if (!factory) {
            factory = function(){
                this.superConstructor.apply(this, arguments);
            };
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

/* @source mo/console.js */;


define('mo/console', [
  "mo/lang",
  "mo/browsers",
  "mo/template/string",
  "mo/domready"
], function(_, browsers, tpl){

    var console = this.console = this.console || {},
        origin_console = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error
        },
        RE_CODE = /^function[^(]*\([^)]*\)[^{]*\{([.\s\S]*)\}$/;

    console._ccBuffer = [];

    console.config = function(opt){

        if (opt.output) {
            this._ccOutput = opt.output;
            this._ccOutput.innerHTML = this._ccBuffer.join('');
        }

        if (opt.record !== undefined) {
            this._recording = opt.record;
            if (!opt.record) {
                console.cc();
            }
        }

        return this;
    };

    console.enable = function(){
        for (var i in origin_console) {
            console[i] = console_api(i);
        }
        console.run = run;
        return this;
    };

    console.disable = function(){
        for (var i in origin_console) {
            console[i] = origin_console[i];
        }
        console.run = console.log;
        return this;
    };

    console.cc = function(newlog){
        if (newlog === undefined) {
            return this._ccBuffer.join('');
        } else {
            this._ccBuffer.push(newlog);
            var result = this._ccBuffer.join('');
            if (!this._recording) {
                //if (!this._ccOutput) {
                    //this._ccOutput = default_output();
                //}
                if (this._ccOutput) {
                    this._ccOutput.innerHTML = result;
                }
            }
            return result;
        }
    };

    function run(fn, opt){
        opt = opt || {};
        var code = fn.toString().trim()
            .match(RE_CODE)[1]
            .trim()
            .replace(/return\s+/, '')
            .replace(/;$/, '');
        console.info('run `' + code + '`');
        try {
            console.info(fn());
        } catch(ex) {
            console.error(opt.showStack ? ex : ex.message);
        }
    }

    function console_api(method){
        return function(){
            if (_.isFunction(origin_console[method])) {
                origin_console[method].apply(console, arguments);
            }
            console.cc('<p>'
                + '<span class="type type-' + method + '"></span>'
                + '<span class="log">'
                + Array.prototype.slice.call(arguments)
                    .map(escape_log, method).join('</span><span class="log">')
                + '</span></p>');
        };
    }

    //function default_output(){
        //var output = document.createElement('DIV');
        //output.setAttribute('id', 'console');
        //document.body.insertBefore(output, document.body.firstChild);
        //return output;
    //}

    function escape_log(text){
        var method = this;
        if (text instanceof Error) {
            text = text.stack ? text.stack.split(/at\s/) : [text.message];
            return text.map(function(msg){
                return escape_log('at ' + msg, method);
            }).join('<br>');
        } else if (method.toString() !== 'log' 
                && text 
                && typeof text === 'object'
                && (!browsers.aosp || text.nodeType !== 1)) {
            text = [
                '<span class="obj-start">' + tpl.escapeHTML('{') + '</span>', 
                Object.keys(text).map(function(key){
                    var v;
                    try {
                        v = this[key];
                    } catch(ex) {
                        v = ex.message;
                    }
                    if (typeof v === 'string') {
                        v = '"' + v + '"';
                    } else {
                        v = String(v);
                    }
                    return '<span class="obj-item">' 
                        + '<span class="obj-k">'
                        + escape_log(key, method) 
                        + ': </span><span class="obj-v">'
                        + (typeof v === 'string' ? tpl.escapeHTML(v) : v)
                        + '</span>,</span>';
                }, text).join(''), 
                '<span class="obj-end">' + tpl.escapeHTML('}') + '</span>'
            ].join('');
            return '<span class="obj-wrap"><span class="obj-overview">' 
                + text
                + '</span><span class="obj-end">...}</span><span class="obj-detail">' 
                + text 
                + '</span></span></span>';
        }
        text = String(text);
        return typeof text === 'string' ? tpl.escapeHTML(text) : text;
    }

    return console;

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
        MATCHES_SELECTOR = ['webkitMatchesSelector', 'mozMatchesSelector', 'matchesSelector']
            .map(function(name){
                return this[name] && name;
            }, doc.body).filter(pick)[0],
        MOUSE_EVENTS = { click: 1, mousedown: 1, mouseup: 1, mousemove: 1 },
        TOUCH_EVENTS = { touchstart: 1, touchmove: 1, touchend: 1, touchcancel: 1 },
        CSS_NUMBER = { 
            'column-count': 1, 'columns': 1, 'font-weight': 1, 
            'line-height': 1, 'opacity': 1, 'z-index': 1, 'zoom': 1 
        },
        RE_HTMLTAG = /^\s*<(\w+|!)[^>]*>/,
        isFunction = detect.isFunction,
        _array_map = Array.prototype.map,
        _array_push = Array.prototype.push,
        _array_slice = Array.prototype.slice,
        _getComputedStyle = document.defaultView.getComputedStyle,
        _elm_display = {},
        _html_containers = {};


    function $(selector, context){
        if (selector) {
            if (selector.constructor === $) {
                return selector;
            } else if (typeof selector !== 'string') {
                var nodes = new $();
                if (selector.push === _array_push || selector[0]) {
                    _array_push.apply(nodes, _array_slice.call(selector));
                } else {
                    _array_push.call(nodes, selector);
                }
                return nodes;
            } else {
                selector = selector.trim();
                if (RE_HTMLTAG.test(selector)) {
                    return create_nodes(selector);
                } else if (context) {
                    return $(context).find(selector);
                } else {
                    return ext.find(selector);
                }
            }
        } else if (this === window) {
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
            if (/^#[\w_]+$/.test(selector)) {
                var elm = ((contexts[0] || doc).getElementById 
                    || doc.getElementById).call(doc, selector.substr(1));
                if (elm) {
                    nodes.push(elm);
                }
            } else {
                var query = /\W/.test(selector) ? 'querySelectorAll' 
                                                : 'getElementsByTagName';
                if (contexts[1]) {
                    contexts.forEach(function(context){
                        this.push.apply(this, _array_slice.call(context[query](selector)));
                    }, nodes);
                } else if (contexts[0]) {
                    nodes.push.apply(nodes, _array_slice.call(contexts[0][query](selector)));
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
            var r = new $();
            this.forEach(function(node){
                this(r, $(node.children));
            }, _.merge);
            return r;
        },

        contents: function(){
            var r = new $();
            this.forEach(function(node){
                this(r, $(node.childNodes));
            }, _.merge);
            return r;
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

        isEmpty: function(){
            return this.every(function(elm){
                if (!elm.innerHTML) {
                    elm.innerHTML = ' ';
                    if (!elm.innerHTML) {
                        return true;
                    }
                    elm.innerHTML = '';
                }
                return false;
            });
        },

        // Properties

        addClass: function(cname){
            return each_node(this, cname, 'className', function(node, cname){
                node.classList.add(cname);
            });
        },

        removeClass: function(cname){
            return each_node(this, cname, 'className', function(node, cname){
                node.classList.remove(cname);
            });
        },

        toggleClass: function(cname, force){
            return each_node(this, cname, 'className', function(node, cname){
                node.classList[force === undefined && 'toggle'
                                    || this && 'add' || 'remove'](cname);
            });
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
            var data = (node || {}).dataset;
            return name ? data[css_method(name)] 
                : _.mix({}, data);
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
                return each_node(this, value, 'value', function(node, value){
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
                : each_node(this, str, 'innerHTML', function(node, str){
                    if (RE_HTMLTAG.test(str)) {
                        this(node).empty().append(str);
                    } else {
                        node.innerHTML = str;
                    }
                }, $);
        },

        text: function(str){
            return str === undefined ? (this[0] || {}).textContent
                : each_node(this, str, 'textContent', function(node, str){
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
            return each_node(this, boxes, false, function(node, boxes){
                this(boxes).insertBefore(node).append(node);
            }, $);
        },

        wrapAll: function(boxes){
            $(boxes).insertBefore(this.eq(0)).append(this);
            return this;
        },

        wrapInner: function(boxes){
            return each_node(this, boxes, false, function(node, boxes){
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
            $(this).on(subject, fn);
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

    function each_node(nodes, arg, prop, cb, context){
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
                subject = Event.aliases[subject] || subject;
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
        type = Event.aliases[type] || type;
        event[is_touch && 'initTouchEvent' 
            || 'initEvent'](type, bubbles, true);
        return event;
    }

    Event.aliases = {};

    function trigger(me, event, data){
        if (this === $) {
            me = $(me);
        } else {
            data = event;
            event = me;
            me = this;
        }
        if (typeof event === 'string') {
            event = Event(event);
        }
        _.mix(event, data);
        me.forEach(event.type == 'submit' 
            && !event.defaultPrevented 
                ? function(node){
                    node.submit();
                } : function(node){
                    if ('dispatchEvent' in node) {
                        node.dispatchEvent(this);
                    }
                }, event);
        return this;
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
    $.matchesSelector = matches_selector;
    $.createNodes = create_nodes;
    $.camelize = css_method;
    $.dasherize = css_prop;
    $.Event = Event;
    $.trigger = trigger;
    $._kvAccess = kv_access;
    $._eachNode = each_node;

    $.VERSION = '1.2.0';

    return $;

});

/* @source dollar/android23.js */;

/**
 * DollarJS polyfills for android 2.x
 * A jQuery-compatible and non-All-in-One library which is more "Zepto" than Zepto.js
 * Focus on DOM operations and mobile platform, wrap native API wherever possible.
 *
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("dollar/android23", [
  "mo/lang/es5",
  "mo/lang/mix",
  "mo/lang/type",
  "dollar/origin"
], function(es5, _, detect, $){

    var css_method = $.camelize;

    _.mix($.fn, {

        data: $._kvAccess(function(node, name, value){
            node.setAttribute('data-' + prop2data(name), value);
        }, function(node, name){
            if (name) {
                return node.getAttribute('data-' + prop2data(name));
            } else {
                var data = {};
                node.outerHTML
                    .replace(node.innerHTML, '')
                    .split(/\s+/)
                    .forEach(function(html){ 
                        var attr = (/^data-([\w\-]+)/.exec(html) || []); 
                        if (data[0]) {
                            this[css_method(attr[1])] = node.getAttribute(attr[0]);
                        }
                    }, data);
                return data;
            }
        }),

        removeData: function(name){
            this.forEach(function(node){
                node.removeAttribute('data-' + prop2data(this));
            }, name);
            return this;
        },

        hasClass: function(cname){
            for (var i = 0, l = this.length; i < l; i++) {
                if (class_list(this[i]).indexOf(cname) !== -1) {
                    return true;
                }
            }
            return false;
        },

        addClass: function(cname){
            return $._eachNode(this, cname, 'className', function(node, cname){
                var list = class_list(node);
                if (list.indexOf(cname) === -1) {
                    list.push(cname);
                    node.className = list.join(' ');
                }
            });
        },

        removeClass: function(cname){
            return $._eachNode(this, cname, 'className', function(node, cname){
                var list = class_list(node),
                    n = list.indexOf(cname);
                if (n !== -1) {
                    list.splice(n, 1);
                    node.className = list.join(' ');
                }
            });
        },

        toggleClass: function(cname, force){
            return $._eachNode(this, cname, 'className', function(node, cname){
                var list = class_list(node),
                    n = list.indexOf(cname),
                    is_add = force;
                if (is_add === undefined) {
                    is_add = n === -1;
                }
                if (is_add) {
                    if (n === -1) {
                        list.push(cname);
                    }
                } else {
                    if (n !== -1) {
                        list.splice(n, 1);
                    }
                }
                node.className = list.join(' ');
            });
        }
    
    });

    function prop2data(name){
        return name.replace(/([A-Z])/g, function($0, $1){ 
            return '-' + $1.toLowerCase(); 
        });
    }

    function class_list(elm){
        return elm.className.split(/\s+/);
    }

    return $;

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
        //CANCEL: 'touchcancel',

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
                    self._press || (self._press = self.press.bind(self)))
                .bind(self.MOVE, 
                    self._move || (self._move = self.move.bind(self)))
                .bind(self.CANCEL, 
                    self._cancel || (self._cancel = self.cancel.bind(self)))
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
                .unbind(self.CANCEL, self._cancel)
                .unbind(self.RELEASE, self._release);
            if (self._listener) {
                self.unbind(this.event[this._config.event], self._listener);
            }
            return self;
        },

        once: function(ev, handler, node){
            var self = this;
            this.bind(ev, fn, node);
            function fn(){
                self.unbind(ev, fn, node);
                return handler.apply(this, arguments);
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

    function nothing(){}

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoBase;

    return exports;

});

/* @source momo/scroll.js */;

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
define('momo/scroll', [
  "mo/lang",
  "momo/base"
], function(_, momoBase){

    var MomoScroll = _.construct(momoBase.Class);

    _.mix(MomoScroll.prototype, {

        EVENTS: [
            'scrolldown', 
            'scrollup', 
            'scrollstart', 
            'scrollend'
        ],
        DEFAULT_CONFIG: {
            'directThreshold': 5,
            'scrollEndGap': 5
        },

        watchScroll: function(elm){
            this.scrollingNode = elm;
        },

        checkScollDirection: function(y){
            var node = { target: this.node },
                d = y - this._lastY,
                threshold = this._config.directThreshold;
            if (d < 0 - threshold) {
                if (this._scrollDown !== true) {
                    this.trigger(node, this.event.scrolldown);
                }
                this._lastY = y;
                this._scrollDown = true;
            } else if (d > threshold) {
                if (this._scrollDown !== false) {
                    this.trigger(node, this.event.scrollup);
                }
                this._lastY = y;
                this._scrollDown = false;
            }
        },

        press: function(e){
            var self = this,
                t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            self._scrollDown = null;
            self._lastY = t.clientY;
            self._scrollY = null;
            self._ended = false;
            if (self.scrollingNode) {
                var scrolling = self._scrolling;
                self._scrolling = false;
                var tm = self._tm = e.timeStamp;
                self.once(self.MOVE, function(){
                    self.once('scroll', function(){
                        if (tm === self._tm) {
                            if (!scrolling) {
                                self._started = true;
                                self.trigger({ target: self.node }, self.event.scrollstart);
                                if (self._ended) {
                                    self._ended = false;
                                    self.trigger({ target: self.node }, self.event.scrollend);
                                }
                            }
                        }
                    }, self.scrollingNode);
                });
            }
        },

        move: function(e){
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this.checkScollDirection(t.clientY);
            //this._lastY = t.clientY;
            if (this.scrollingNode) {
                this._scrollY = this.scrollingNode.scrollTop;
            }
        },

        release: function(e){
            var self = this, 
                t = this.SUPPORT_TOUCH ? e.changedTouches[0] : e,
                node = { target: self.node };
            // up/down
            this.checkScollDirection(t.clientY);
            // end
            if (self._scrollY !== null) {
                var vp = self.scrollingNode,
                    gap = Math.abs(vp.scrollTop - self._scrollY) || 0;
                if (self._scrollY >= 0 && (self._scrollY <= vp.scrollHeight + vp.offsetHeight)
                        && gap < self._config.scrollEndGap) {
                    if (self._started) {
                        self.trigger(node, self.event.scrollend);
                        self._started = false;
                    } else {
                        self._ended = true;
                    }
                } else {
                    var tm = self._tm;
                    self._scrolling = true;
                    self.once('scroll', function(){
                        if (tm === self._tm) {
                            self._scrolling = false;
                            self._started = false;
                            self.trigger(node, self.event.scrollend);
                        }
                    }, vp);
                }
                self._scrollY = null;
            } else if (self._started) {
                self._started = false;
                self.trigger(node, self.event.scrollend);
            }
        }
    
    });

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoScroll;

    return exports;

});

/* @source momo/drag.js */;

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
define('momo/drag', [
  "mo/lang",
  "momo/base"
], function(_, momoBase){

    var MomoDrag = _.construct(momoBase.Class);

    _.mix(MomoDrag.prototype, {

        EVENTS: [
            'drag',
            'dragover',
            'dragstart',
            'dragend'
        ],
        DEFAULT_CONFIG: {
            'dragThreshold': 200
        },

        checkDrag: function(){
            if (this._holding) {
                this._holding = false;
                clearTimeout(this._startTimer);
            }
        },

        press: function(e){
            var self = this,
                t = self.SUPPORT_TOUCH ? e.touches[0] : e,
                src = t.target;
            //if (src.getAttribute('draggable') !== 'true') {
                //return;
            //}
            self._srcTarget = false;
            self._holding = true;
            self._startTimer = setTimeout(function(){
                self._holding = false;
                self._srcTarget = src;
                self.trigger(_.copy(t), self.event.dragstart);
            }, self._config.dragThreshold);
        },

        move: function(e){
            this.checkDrag();
            if (!this._srcTarget) {
                return;
            }
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this.trigger(_.merge({ 
                target: this._srcTarget 
            }, t), this.event.drag);
            this.trigger(_.copy(t), this.event.dragover);
        },

        release: drag_end,

        cancel: drag_end

    });

    function drag_end(e){
        this.checkDrag();
        if (!this._srcTarget) {
            return;
        }
        var t = this.SUPPORT_TOUCH ? e.changedTouches[0] : e;
        this.trigger(_.merge({ 
            target: this._srcTarget 
        }, t), this.event.dragend);
        this._srcTarget = false;
    }

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoDrag;

    return exports;

});

/* @source momo/swipe.js */;

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
define('momo/swipe', [
  "mo/lang",
  "momo/base"
], function(_, momoBase){

    var MomoSwipe = _.construct(momoBase.Class);

    _.mix(MomoSwipe.prototype, {

        EVENTS: [
            'swipeup',
            'swipedown',
            'swiperight',
            'swipeleft'
        ],
        DEFAULT_CONFIG: {
            'timeThreshold': 200,
            'distanceThreshold': 20
        },

        press: function(e) {
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this._startX = t.clientX;
            this._startY = t.clientY;
            this._moveX = NaN;
            this._moveY = NaN;
            this._startTime = e.timeStamp;
        },

        move: function(e) {
            var t = this.SUPPORT_TOUCH ? e.touches[0] : e;
            this._moveX = t.clientX;
            this._moveY = t.clientY;
        },

        release: function(e) {
            var self = this,
                startPos = {
                    x: self._startX,
                    y: self._startY
                },
                movePos = {
                    x: self._moveX,
                    y: self._moveY
                },
                distance = get_distance(startPos, movePos),
                direction = get_direction(startPos, movePos),
                touchTime = e.timeStamp - self._startTime;

            if (touchTime < self._config.timeThreshold &&
                    distance > self._config.distanceThreshold) {
                self.trigger(e, self.event['swipe' + direction]);
            }
        }

    });

    function get_distance(pos1, pos2) {
        var x = pos2.x - pos1.x,
            y = pos2.y - pos1.y;
        return Math.sqrt((x * x) + (y * y));
    }

    function get_angle(pos1, pos2) {
        return Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x) * 180 / Math.PI;
    }

    function get_direction(pos1, pos2) {
        var angle = get_angle(pos1, pos2);
        var directions = {
            down: angle >= 45 && angle < 135, //90
            left: angle >= 135 || angle <= -135, //180
            up: angle < -45 && angle > -135, //270
            right: angle >= -45 && angle <= 45 //0
        };

        var direction, key;
        for(key in directions){
            if(directions[key]){
                direction = key;
                break;
            }
        }
        return direction;
    }

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoSwipe;

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

/* @source momo.js */;

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
define('momo', [
  "mo/lang",
  "dollar",
  "momo/base",
  "momo/tap",
  "momo/swipe",
  "momo/drag",
  "momo/scroll"
], function(_, $, momoBase,
    momoTap, momoSwipe, momoDrag, momoScroll){

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
            $(e.target).trigger(ev, e);
            return this;
        }
    });

    var lib = {
        tap: momoTap,
        swipe: momoSwipe,
        drag: momoDrag,
        scroll: momoScroll
    };

    var exports = {
        base: momoBase
    };

    for (var name in lib) {
        exports[name] = lib[name];
    }

    exports.init = function(elm, opt, cb){
        for (var name in lib) {
            this[name](elm, opt, cb);
        }
    };

    return exports;

});

/* @source  */;


define('dollar', [
    'dollar/android23'
], function($){
    return $;
});

//define('history.src', 'history.js');
//define('history', [
   //'dollar', 
   //'history.src', 
   //'mo/domready'
//], function($){
    //var History = this.History;
    //History.Adapter = $;
    //History.Adapter.onDomLoad = function(fn){
        //fn();
    //};
    //History.init();
    //return History;
//});

require([
    'mo/lang',
    'dollar', 
    'mo/browsers',
    'momo',
    'soviet',
    //'history',
    'mo/console'
], function(_, $, browsers, momo, soviet, 
        //History, 
        console){

    console.config({
        output: $('#console')[0]
    }).enable();

    console.info('init', 3, navigator.userAgent, location, document);

    console.info('browsers', browsers);

    var soviet_aliases = {};
    var momoTapEvents = momo.tap(document, {
        namespace: 'ck_'
    }).event;
    set_aliases_for_momo(momoTapEvents);
    function set_aliases_for_momo(momoEvents) {
        for (var ev in momoEvents) {
            $.Event.aliases[ev] = soviet_aliases[ev] = momoEvents[ev];
        }
    }

    console.run(function(){
        return $('.btn1')[0];
    }, { showStack: true });

    var test = $('#test');

    console.run(function(){
        return test[0].dataset.a;
    });
    console.run(function(){
        return Array.prototype.push.apply([], test);
    });
    console.run(function(){
        return Array.prototype.push.apply($(), test);
    });
    console.run(function(){
        return Array.prototype.push.apply([], test[0].children);
    });
    console.run(function(){
        return Array.prototype.slice.call(test[0].children);
    });
    console.run(function(){
        return Array.prototype.push.apply([], Array.prototype.slice.call(test[0].children));
    });
    console.run(function(){
        return test[0].getAttribute('data-a');
    });
    console.run(function(){
        return test[0]['data-a'];
    });
    console.run(function(){
        return test[0].classList.contains;
    });
    console.run(function(){
        return document.defaultView.getComputedStyle(test[0], '').getPropertyValue('padding-top');
    });
    console.run(function(){
        return typeof function(){}.bind;
    });

    //$(document).bind('tap', function(e){
        //console.info(e)
    //});

    $('.btn1').bind('click', function(){
        console.info('before toggleClass: ', test[0].className);
        test.toggleClass('yy');
        console.info('after toggleClass: ', test[0].className);
    });

    $('.btn2').bind('click', function(){
        test.data('enable-url', 1);
    });

    $('.btn3').bind('click', function(){
        test.data('enableUrl', 2);
    });

    $('.btn4').bind('click', function(){
        console.info('data: ', test.data());
        console.info('data("enable-url"): ', test.data('enable-url'));
        console.info('data("enableUrl"): ', test.data('enableUrl'));
    });

    var n = 0;

    $('.btn5').bind('click', function(){
        push_history();
    });

    $(window).bind("popstate", function(e){
        console.warn('popstate', e, e.state, history, history.state);
    });

    console.warn('init history', history, history.state);

    //if (History.enabled) {
    
        //$(window).bind("statechange", function(){
            //var state = History.getState();
            //console.warn('statechange', state, state.data);
        //});

        //console.warn('init History', History, History.getState().data);

    //}

    function push_history(){
        var data = {
            prev: n,
            next: ++n,
            i: history.length
        };
        history.pushState(_.mix({}, data), document.title, location.href);
        console.warn('push history', history, history.state);
        //if (History.enabled) {
            //History.pushState(_.mix({}, data), document.title, location.href);
            //console.warn('push History', History, History.getState().data);
        //}
    }

    $('.btn6').bind('click', add_hash);

    $('.btn7').bind('click', replace_hash);

    $(window).bind("hashchange", function(){
        console.warn('hashchange', location.hash);
    });

    //add_hash();
    setTimeout(function(){
        //location.href = location.href.replace(/#.*/, '') + '?a=1'
        //add_hash();
    }, 1000);

    //$(window).bind('touchstart', function(){
        //add_hash();
        //$(window).unbind('touchstart', arguments.callee)
    //});

    function add_hash(){
        alert(history.length)
        location.href = location.href.replace(/#(.*)|$/, '#$1' + '!/' + 'cardid');
        alert(history.length)
    }

    function replace_hash(){
        alert(history.length + ', ' + location.href)
        location.replace(location.href.replace(/#(.*)|$/, '#$1' + '*/' + 'cardid'))
        alert(history.length + ', ' + location.href)
    }

    $('.btn8').bind('click', function(){
        alert(history.length)
        history.back();
    });

    $('.btn9').bind('click', function(){
        alert(history.length)
        history.back();
        $(window).bind("hashchange", function(){
            setTimeout(function(){
                alert(history.length)
                history.back();
            }, 500)
        });
    });

    soviet(document, {
        aliasEvents: soviet_aliases,
        matchesSelector: true,
        preventDefault: true
    }).on('tap', {
        '.btn10': function(e){
            alert('tap: ' + e.type)
        }
    });

});

