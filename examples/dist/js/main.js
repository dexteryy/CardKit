/*! cardkit - v1.3.1 */
;

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

    var match, skin, os, is_mobile, is_webview,
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
            rwebview = /(.)([^\/]+)[ \/]mobile\//,
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

        is_mobile = rmobilesafari.exec(ua) || (is_webview = rwebview.exec(ua));

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
                    || is_webview && 'webview'
                    || vendor[1];
                match[2] = is_webview ? 0 : vendor[2];
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

/* @source ../cardkit/supports.js */;

define("../cardkit/supports", [
  "mo/browsers",
  "cardkit/env"
], function(browsers, env){

    var window = this,
        document = window.document,
        body = document.body,
        is_android = browsers.os === 'android',
        is_ios = browsers.os === 'iphone' || browsers.os === 'ipad',
        is_ios5 = is_ios
            && browsers.engine === 'webkit'
            && parseFloat(browsers.engineversion) < 536,
        is_ios7 = parseFloat(browsers.osversion) >= 7,
        is_mobilefirefox = browsers.mozilla && is_android,
        is_desktop = browsers.os === 'mac'
            || browsers.os === 'windows'
            || browsers.os === 'linux';

    var exports = {
    
        //HISTORY: 'pushState' in history
            //&& !browsers.crios 
            //&& !browsers.aosp
            //&& !is_mobilefirefox
            //&& !is_ios5,

        GOBACK_WHEN_POP: !is_ios5
            && !browsers.aosp,

        REPLACE_HASH: !is_ios5
            && !browsers.aosp,

        BROWSER_CONTROL: is_desktop
            || browsers.mobilesafari
            //|| browsers.shell === 'micromessenger'
            //|| browsers.aosp
            || is_android && browsers.chrome,

        NO_POP_ON_CACHED_PAGE: is_mobilefirefox, 

        RESIZE_WHEN_SCROLL: is_mobilefirefox,

        FIXED_BOTTOM_BUGGY: browsers.crios,

        NEW_WIN: !is_ios5 
            && !browsers.aosp,

        CARD_SCROLL: !is_desktop
            && !browsers.aosp,

        HIDE_ADDRESSBAR: !browsers.crios,

        PREVENT_WINDOW_SCROLL: !!browsers.mobilesafari,

        FULLSCREEN_MODE: browsers.webview || env.fullscreenMode,

        FOLDABLE_URLBAR: browsers.mobilesafari && !is_ios7

    };

    exports.SAFARI_OVERFLOWSCROLL = "webkitOverflowScrolling" in body.style
        && (exports.CARD_SCROLL || is_ios5);

    //exports.PREVENT_CACHE = browsers.aosp 
        //|| browsers.mobilesafari && !exports.HISTORY;

    //exports.UNIVERSAL_TRANS = exports.HISTORY
        //&& exports.CARD_SCROLL
        //&& !browsers.aosp 
        //&& !is_ios5
        //&& !is_desktop;

    exports.WINDOW_SCROLL = !exports.CARD_SCROLL 
        || is_android;

    return exports;

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

/* @source ../cardkit/parser/util.js */;


define("../cardkit/parser/util", [
  "dollar",
  "mo/lang"
], function($){

    var RE_CKD_NAME = /([^\w-])ckd\-([\w\-]+)(?=[^\w\-])/;

    var exports = {

        mergeSource: mergeSource,

        getSource: function(node, raw){
            var sid = $(node).data('source');
            if (sid) {
                var source = raw.find('.' + sid);
                return source[0] && source || false;
            }
        },

        getHref: getHref,

        getText: getText,

        getInnerHTML: getInnerHTML,

        getOuterHTML: getOuterHTML,

        replaceOuterHTML: replaceOuterHTML,

        getCustom: getCustom,

        getHd: getHd,

        getItemData: getItemData,

        getItemDataOuter: getItemDataOuter

    }; 

    function getHref(nodes){
        if (!nodes) {
            return;
        }
        for (var href, i = 0, l = nodes.length; i < l; i++) {
            href = nodes[i].href;
            if (href) {
                return href;
            }
        }
    }

    function getText(nodes){
        return nodes.map(function(elm){
            return elm.textContent;
        }).join('');
    }

    function getInnerHTML(nodes){
        return nodes.map(function(elm){
            return elm.innerHTML;
        }, $).join('');
    }

    function getOuterHTML(nodes, name){
        return nodes.map(function(elm){
            var html = elm.outerHTML;
            if (!name) {
                return html;
            }
            return html.replace(RE_CKD_NAME, function($0, $1, $2){ 
                if ($2 === name) {
                    return $1 + 'ck-' + $2;
                } else {
                    return $0;
                }
            });
        }, $).join('');
    }

    function replaceOuterHTML(target, nodes, name){
        return nodes.forEach(function(elm){
            var html = elm.outerHTML;
            html = html.replace(RE_CKD_NAME, function($0, $1, $2){ 
                if ($2 === name) {
                    return $1 + 'ck-' + $2;
                } else {
                    return $0;
                }
            });
            this.replaceWith(html);
        }, target);
    }

    function getCustom(tag, unit, raw, fn, ckdname){
        var tags = unit.find(tag);
        if (!tags.length) {
            return tags;
        }
        return tags.map(function(elm){
            var source = exports.getSource(elm, raw);
            if (source) {
                var content = source.find(tag);
                if (!content[0]) {
                    content = source;
                }
                return fn(content, elm, ckdname, raw);
            }
            return fn(elm, undefined, ckdname, raw);
        });
    }

    function mergeSource(data, custom, fn, raw){
        if (custom && typeof custom === 'object') {
            custom = fn(custom, null, null, raw);
            for (var i in custom) {
                if (custom[i] 
                        && (!(custom[i] instanceof Array) 
                            && true || custom[i].length)) {
                    data[i] = custom[i];
                }
            }
        }
        return data;
    }

    function getHd(source, custom){
        source = $(source);
        var data = source && {
            html: getInnerHTML(source),
            href: getHref(source)
        } || {};
        return mergeSource(data, custom, getHd);
    }

    function getItemData(item, custom, ckdname, raw){
        item = $(item);
        var title_data = getCustom('.ckd-title', item, raw, getItemDataInner, 'title')[0],
            author_data = getCustom('.ckd-author', item, raw, getItemDataInner, 'author')[0],
            icon_src = getCustom('.ckd-icon', item, raw, getItemDataSrc, 'icon')[0],
            title_url_alone,
            title_url_extern,
            title_url,
            author_url_extern,
            author_url;
        if (!title_data && !author_data && !icon_src) {
            title_data = getInnerHTML(item);
            title_url_alone = item.hasClass('ckd-title-link-alone');
            title_url_extern = item.hasClass('ckd-title-link-extern');
            title_url = getHref(item);
        } else {
            title_url_alone = getCustom('.ckd-title-link-alone', item, raw, getItemDataHref, 'title-link-alone')[0];
            title_url_extern = title_url_alone 
                    || getCustom('.ckd-title-link-extern', item, raw, getItemDataHref, 'title-link-extern')[0];
            title_url = title_url_extern
                    || getCustom('.ckd-title-link', item, raw, getItemDataHref, 'title-link')[0]
                    || getCustom('.ckd-title', item, raw, getItemDataHref, 'title')[0];
            author_url_extern = getCustom('.ckd-author-link-extern', item, raw, getItemDataHref, 'author-link-extern')[0];
            author_url = author_url_extern
                || getCustom('.ckd-author-link', item, raw, getItemDataHref, 'author-link')[0]
                || getCustom('.ckd-author', item, raw, getItemDataHref, 'author')[0];
        }
        var data = {
            title: title_data,
            href: !title_url_alone && title_url,
            hrefAlone: title_url_alone,
            hrefExtern: title_url_extern,
            titlePrefix: getCustom('.ckd-title-prefix', item, raw, getItemDataOuter, 'title-prefix'),
            titleSuffix: getCustom('.ckd-title-suffix', item, raw, getItemDataOuter, 'title-suffix'),
            titleTag: getCustom('.ckd-title-tag', item, raw, getItemDataOuter, 'title-tag'),
            icon: icon_src,
            desc: getCustom('.ckd-desc', item, raw, getItemDataOuter, 'desc')
                .concat(getCustom('.ckd-subtitle', item, raw, getItemDataOuter, 'subtitle')),
            info: getCustom('.ckd-info', item, raw, getItemDataOuter, 'info'),
            opt: getCustom('.ckd-opt', item, raw, getItemDataOuter, 'opt'),
            content: getCustom('.ckd-content', item, raw, getItemDataOuter, 'content'),
            meta: getCustom('.ckd-meta', item, raw, getItemDataOuter, 'meta'),
            author: author_data,
            authorUrl: author_url,
            authorUrlExtern: author_url_extern,
            authorPrefix: getCustom('.ckd-author-prefix', item, raw, getItemDataOuter, 'author-prefix'),
            authorSuffix: getCustom('.ckd-author-suffix', item, raw, getItemDataOuter, 'author-suffix'),
            avatar: getCustom('.ckd-avatar', item, raw, getItemDataSrc, 'avatar')[0],
            authorDesc: getCustom('.ckd-author-desc', item, raw, getItemDataOuter, 'author-desc'),
            authorInfo: getCustom('.ckd-author-info', item, raw, getItemDataOuter, 'author-info'),
            authorMeta: getCustom('.ckd-author-meta', item, raw, getItemDataOuter, 'author-meta')
        };
        return mergeSource(data, custom, getItemData, raw);
    }

    function getItemDataSrc(source){
        source = $(source);
        return source.attr('src');
    }

    function getItemDataHref(source){
        source = $(source);
        return getHref(source);
    }

    function getItemDataInner(source){
        source = $(source);
        return getInnerHTML(source);
    }

    function getItemDataOuter(source, custom, ckdname){
        source = $(source);
        return getOuterHTML(source, ckdname);
    }

    return exports;

});

/* @source ../cardkit/parser/navdrawer.js */;


define("../cardkit/parser/navdrawer", [
  "dollar",
  "mo/lang",
  "../cardkit/parser/util"
], function($, _, util){
    
    var getCustom = util.getCustom,
        getHd = util.getHd,
        getItemDataOuter = util.getItemDataOuter;

    function exports(cfg, raw){
        cfg = $(cfg);
        var source = util.getSource(cfg, raw),
            config = {},
            hd = getHd(source && source.find('.ckd-hd')),
            contents = source && source.find('.ckd-content').map(function(elm){
                return getCustom('.ckd-content', elm, raw, getItemDataOuter, 'content').join('') 
                    || util.getInnerHTML(elm);
            }) || $(),
            custom_hd = getCustom('.ckd-hd', cfg, raw, getHd)[0] || {},
            custom_contents = getCustom('.ckd-content', cfg, raw, getItemDataOuter, 'content').join('') 
                    || '';
        var data = {
            config: config,
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            content: custom_contents + contents.join(''),
        };
        return data;
    }

    return exports;

});

/* @source ../cardkit/parser/actionbar.js */;


define("../cardkit/parser/actionbar", [
  "dollar",
  "mo/lang",
  "../cardkit/parser/util",
  "../cardkit/supports"
], function($, _, util, supports){
    
    function exports(cfg, raw){
        cfg = $(cfg);
        var source = util.getSource(cfg, raw),
            config = {
                limit: cfg.data('cfgLimit') 
                    || !supports.FULLSCREEN_MODE && 1
                    || 0
            },
            items = source && source.find('.ckd-item').map(function(elm){
                return util.getItemDataOuter(elm, null, 'item');
            }) || $(),
            overflow_items = source && source.find('.ckd-overflow-item').map(function(elm){
                return util.getItemDataOuter(elm, null, 'overflow-item');
            }) || $(),
            custom_items = util.getCustom('.ckd-item', cfg, raw, util.getItemDataOuter, 'item'),
            custom_overflow_items = util.getCustom('.ckd-overflow-item', cfg, raw, util.getItemDataOuter, 'overflow-item');
        if (source === false && !custom_items.length) {
            return false;
        }
        var data = {
            config: config,
            items: custom_items.concat(items || $()),
            overflowItems: custom_overflow_items.concat(overflow_items || $())
        };
        return data;
    }

    return exports;

});

/* @source ../cardkit/parser/banner.js */;


define("../cardkit/parser/banner", [
  "dollar",
  "mo/lang",
  "../cardkit/parser/util"
], function($, _, util){
    
    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {},
            contents = source && util.getOuterHTML(source);
        var data = {
            config: config,
            content: unit[0].innerHTML + (contents || ''),
        };
        if (data.content && /\S/.test(data.content)){
            data.hasContent = true;
        }
        return data;
    }

    return exports;

});

/* @source ../cardkit/parser/form.js */;


define("../cardkit/parser/form", [
  "dollar",
  "mo/lang",
  "../cardkit/parser/util"
], function($, _, util){
    
    var getCustom = util.getCustom,
        getHd = util.getHd,
        getItemDataOuter = util.getItemDataOuter;

    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                blank: unit.data('cfgBlank'),
                plainhd: unit.data('cfgPlainhd')
            },
            hd = getHd(source && source.find('.ckd-hd')),
            hd_link_extern = getHd(source && source.find('.ckd-hd-link-extern')),
            hd_link = hd_link_extern.href 
                ? hd_link_extern
                : getHd(source && source.find('.ckd-hd-link')),
            hd_opt = getItemDataOuter(source && source.find('.ckd-hdopt'), 'hdopt'),
            ft = getHd(source && source.find('.ckd-ft')),
            items = source && source.find('.ckd-item').map(function(elm){
                return getFormItemData(elm, null, null, raw);
            }) || $(),
            custom_hd = getCustom('.ckd-hd', unit, raw, getHd)[0] || {},
            custom_hd_link_extern = getCustom('.ckd-hd-link-extern', unit, raw, getHd)[0] || {},
            custom_hd_link = custom_hd_link_extern.href 
                ? custom_hd_link_extern
                : (getCustom('.ckd-hd-link', unit, raw, getHd)[0] || {}),
            custom_hd_opt = getCustom('.ckd-hdopt', unit, raw, getItemDataOuter, 'hdopt').join(''),
            custom_ft = getCustom('.ckd-ft', unit, raw, getHd)[0] || {},
            custom_items = getCustom('.ckd-item', unit, raw, getFormItemData);
        var data = {
            config: config,
            style: unit.data('style'),
            items: custom_items.concat(items || $()),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd_link.href 
                || custom_hd_link.href !== null && hd_link.href 
                || custom_hd.href 
                || custom_hd.href !== null && hd.href,
            hd_url_extern: custom_hd_link_extern.href || hd_link_extern.href,
            hd_opt: custom_hd_opt + hd_opt,
            ft: custom_ft.html === undefined ? ft.html : custom_ft.html
        };
        return data;
    }

    function getFormItemData(item, custom, ckdname, raw){
        item = $(item);
        var data = {
            content: getCustom('.ckd-content', item, raw, getItemDataOuter, 'content').join('') 
                || util.getInnerHTML(item),
        };
        return util.mergeSource(data, custom, getFormItemData, raw);
    }

    return exports;

});

/* @source ../cardkit/parser/list.js */;


define("../cardkit/parser/list", [
  "dollar",
  "mo/lang",
  "../cardkit/parser/util"
], function($, _, util){
    
    var getCustom = util.getCustom,
        getHd = util.getHd,
        getItemData = util.getItemData,
        getItemDataOuter = util.getItemDataOuter;

    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                blank: unit.data('cfgBlank'),
                limit: unit.data('cfgLimit'),
                col: unit.data('cfgCol'),
                paper: unit.data('cfgPaper'),
                plain: unit.data('cfgPlain'),
                plainhd: unit.data('cfgPlainhd')
            },
            hd = getHd(source && source.find('.ckd-hd')),
            hd_link_extern = getHd(source && source.find('.ckd-hd-link-extern')),
            hd_link = hd_link_extern.href 
                ? hd_link_extern
                : getHd(source && source.find('.ckd-hd-link')),
            hd_opt = getItemDataOuter(source && source.find('.ckd-hdopt'), 'hdopt'),
            ft = getHd(source && source.find('.ckd-ft')),
            items = source && source.find('.ckd-item').map(function(elm){
                return getItemData(elm, null, null, raw);
            }) || $(),
            custom_hd = getCustom('.ckd-hd', unit, raw, getHd)[0] || {},
            custom_hd_link_extern = getCustom('.ckd-hd-link-extern', unit, raw, getHd)[0] || {},
            custom_hd_link = custom_hd_link_extern.href 
                ? custom_hd_link_extern
                : (getCustom('.ckd-hd-link', unit, raw, getHd)[0] || {}),
            custom_hd_opt = getCustom('.ckd-hdopt', unit, raw, getItemDataOuter, 'hdopt').join(''),
            custom_ft = getCustom('.ckd-ft', unit, raw, getHd)[0] || {},
            custom_items = util.getCustom('.ckd-item', unit, raw, getItemData);
        var data = {
            config: config,
            style: unit.data('style'),
            items: custom_items.concat(items),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd_link.href 
                || custom_hd_link.href !== null && hd_link.href 
                || custom_hd.href 
                || custom_hd.href !== null && hd.href,
            hd_url_extern: custom_hd_link_extern.href || hd_link_extern.href,
            hd_opt: custom_hd_opt + hd_opt,
            ft: custom_ft.html === undefined ? ft.html : custom_ft.html
        };
        if (config.plain 
                || config.plainhd 
                || data.style === 'split') {
            data.hasSplitHd = true;
        }
        return data;
    }

    return exports;

});


/* @source ../cardkit/parser/mini.js */;


define("../cardkit/parser/mini", [
  "dollar",
  "mo/lang",
  "../cardkit/parser/list"
], function($, _, listParser){
    
    function exports(unit, raw){
        var data = listParser(unit, raw);
        data.hasSplitHd = true;
        return data;
    }

    return exports;

});

/* @source ../cardkit/parser/box.js */;


define("../cardkit/parser/box", [
  "dollar",
  "mo/lang",
  "../cardkit/parser/util"
], function($, _, util){
    
    var getCustom = util.getCustom,
        getHd = util.getHd,
        getItemDataOuter = util.getItemDataOuter;

    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                disableReader: unit.data('cfgDisableReader'),
                paper: unit.data('cfgPaper'),
                plain: unit.data('cfgPlain'),
                plainhd: unit.data('cfgPlainhd')
            },
            hd = getHd(source && source.find('.ckd-hd')),
            hd_link_extern = getHd(source && source.find('.ckd-hd-link-extern')),
            hd_link = hd_link_extern.href 
                ? hd_link_extern
                : getHd(source && source.find('.ckd-hd-link')),
            hd_opt = getItemDataOuter(source && source.find('.ckd-hdopt'), 'hdopt'),
            ft = getHd(source && source.find('.ckd-ft')),
            contents = source && util.getOuterHTML(source.find('.ckd-content')),
            custom_hd = getCustom('.ckd-hd', unit, raw, take_hd)[0] || {},
            custom_hd_link_extern = getCustom('.ckd-hd-link-extern', unit, raw, take_hd)[0] || {},
            custom_hd_link = custom_hd_link_extern.href 
                ? custom_hd_link_extern
                : (getCustom('.ckd-hd-link', unit, raw, take_hd)[0] || {}),
            custom_hd_opt = getCustom('.ckd-hdopt', unit, raw, take_item_outer, 'hdopt').join(''),
            custom_ft = getCustom('.ckd-ft', unit, raw, take_hd)[0] || {};
        getCustom('.ckd-content', unit, raw, replace_content);
        var data = {
            config: config,
            style: unit.data('style'),
            content: unit[0].innerHTML + (contents || ''),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd_link.href 
                || custom_hd_link.href !== null && hd_link.href 
                || custom_hd.href 
                || custom_hd.href !== null && hd.href,
            hd_url_extern: custom_hd_link_extern.href || hd_link_extern.href,
            hd_opt: custom_hd_opt + hd_opt,
            ft: custom_ft.html === undefined ? ft.html 
                : (custom_ft.html || (config.plain || config.paper) && ' ')
        };
        if (data.content && /\S/.test(data.content)){
            data.hasContent = true;
        }
        return data;
    }

    function replace_content(source, custom){
        if (custom) {
            $(custom).replaceWith(source.clone());
        } else {
            source = $(source);
            if (!/\S/.test(source.html() || '')) {
                source.remove();
            }
        }
    }

    function take_hd(source, custom){
        var data = getHd(source, custom);
        $(source).remove();
        return data;
    }

    function take_item_outer(source, custom, ckdname){
        var data = getItemDataOuter(source, custom, ckdname);
        $(source).remove();
        return data;
    }

    return exports;

});

/* @source ../cardkit/tpl/layout/actionbar.js */;

define("../cardkit/tpl/layout/actionbar", [], function(){

    return {"template":"\n{% if (actionbar.overflowItems.length) { %}\n<button type=\"button\" class=\"ck-top-overflow ck-item\"></button>\n{% } %}\n\n{% actionbar.items.reverse().forEach(function(item){ %}\n\n    {%=(item)%}\n\n{% }); %}\n\n<span class=\"ck-top-overflow-items\">\n{% actionbar.overflowItems.forEach(function(item){ %}\n\n    {%=(item)%}\n\n{% }); %}\n</span>\n"}; 

});
/* @source ../cardkit/tpl/layout/navdrawer.js */;

define("../cardkit/tpl/layout/navdrawer", [], function(){

    return {"template":"\n{% if (navdrawer.hd) { %}\n<header>{%=navdrawer.hd%}</header>\n{% } %}\n\n<article>\n    <div class=\"ck-nav-wrap\">\n        <div class=\"ck-nav-content\">{%=navdrawer.content%}</div>\n        <div class=\"ck-footer\"></div>\n    </div>\n</article>\n\n"}; 

});
/* @source ../cardkit/tpl/unit/blank.js */;

define("../cardkit/tpl/unit/blank", [], function(){

    return {"template":"\n<div class=\"ck-blank-unit\">\n    <article class=\"ck-unit-wrap\">\n        <div>{%=(data.config.blank || '目前还没有内容')%}</div>\n    </article>\n</div>\n"}; 

});
/* @source ../cardkit/tpl/unit/banner.js */;

define("../cardkit/tpl/unit/banner", [], function(){

    return {"template":"\n<article class=\"ck-unit-wrap {%=(!data.hasContent && 'empty' || '')%}\">\n\n    {% if (data.hasContent) { %}\n    <section>{%= data.content %}</section>\n    {% } %}\n\n</article>\n\n<div class=\"ck-top-tips\"><span>tips: 点击顶栏可返回顶部，向下拖拽顶栏可显示网址</span></div>\n\n"}; 

});
/* @source ../cardkit/tpl/unit/form.js */;

define("../cardkit/tpl/unit/form", [], function(){

    return {"template":"\n{% function hd(){ %}\n    {% if (data.hd) { %}\n    <header class=\"ck-hd-wrap\">\n\n        <span class=\"ck-hd {%= (data.hd_url && 'clickable' || '') %}\">\n            {% if (data.hd_url) { %}\n            <a href=\"{%= data.hd_url %}\" class=\"ck-link ck-link-mask {%= (data.hd_url_extern ? 'ck-link-extern' : '') %}\"></a>\n            {% } %}\n            <span>{%= data.hd %}</span>\n        </span>\n\n        {% if (data.hd_opt) { %}\n        <div class=\"ck-hdopt-wrap\">{%=data.hd_opt%}</div>\n        {% } %}\n\n    </header>\n    {% } %}\n{% } %}\n\n{% if (data.config.plain || data.config.plainhd) { %}\n    {%= hd() %}\n{% } %}\n\n<article class=\"ck-unit-wrap\">\n\n    {% if (!data.config.plain && !data.config.plainhd) { %}\n        {%= hd() %}\n    {% } %}\n\n    <section>\n    {% if (!data.items.length) { %}\n    <div class=\"ck-item blank\">{%=(data.config.blank || '目前还没有内容')%}</div>\n    {% } %}\n    {% data.items.forEach(function(item){ %}\n        <div class=\"ck-item\">\n            {%= item.content %}\n        </div>\n    {% }); %}\n    </section>\n\n    {% if (data.ft) { %}\n    <footer>{%= data.ft %}</footer>\n    {% } %}\n\n</article>\n\n"}; 

});
/* @source ../cardkit/tpl/unit/mini.js */;

define("../cardkit/tpl/unit/mini", [], function(){

    return {"template":"\n{% function hd(){ %}\n    {% if (data.hd) { %}\n    <header class=\"ck-hd-wrap\">\n\n        <span class=\"ck-hd {%= (data.hd_url && 'clickable' || '') %}\">\n            {% if (data.hd_url) { %}\n            <a href=\"{%= data.hd_url %}\" class=\"ck-link ck-link-mask {%= (data.hd_url_extern ? 'ck-link-extern' : '') %}\"></a>\n            {% } %}\n            <span>{%= data.hd %}</span>\n        </span>\n\n        {% if (data.hd_opt) { %}\n        <div class=\"ck-hdopt-wrap\">{%=data.hd_opt%}</div>\n        {% } %}\n\n    </header>\n    {% } %}\n{% } %}\n\n{% if (data.hasSplitHd) { %}\n    {%= hd() %}\n{% } %}\n\n<article class=\"ck-unit-wrap {%= (data.items.length > 1 ? 'slide' : '') %}\">\n\n    {% if (!data.hasSplitHd) { %}\n        {%= hd() %}\n    {% } %}\n\n    <div class=\"ck-list-wrap\">\n    {% if (data.items.length) { %}\n\n        <div class=\"ck-list\">\n        {% data.items.forEach(function(item, i){ %}\n            <div class=\"ck-item {%= (item.href && 'clickable' || '') %}\">\n\n                <div class=\"ck-initem\">\n\n                    {% if (item.href) { %}\n                    <a href=\"{%= item.href %}\" class=\"ck-link ck-link-mask {%= (item.hrefExtern ? 'ck-link-extern' : '') %}\"></a>\n                    {% } %}\n\n                    <div class=\"ck-title-box\">\n\n                        {%= item.opt.join('') %}\n\n                        {% if (item.icon) { %}\n                        <span class=\"ck-icon\">\n                            <img src=\"{%= item.icon %}\"/>\n                        </span>\n                        {% } %}\n\n                        <div class=\"ck-title-set\">\n\n                            {% if (item.title) { %}\n                            <div class=\"ck-title-line\">\n                                {%= item.titlePrefix.join('') %}\n\n                                {% if (item.hrefAlone) { %}\n                                <a href=\"{%= item.hrefAlone %}\" class=\"ck-link {%= (item.hrefExtern ? 'ck-link-extern' : '') %}\">{%= item.title %}</a>\n                                {% } else { %}\n                                <span class=\"ck-title\">{%= item.title %}</span>\n                                {% } %}\n\n                                {%= item.titleSuffix.join('') %}\n                                {%= item.titleTag.join('') %}\n                            </div>\n                            {% } %}\n\n                            {% if (item.info.length) { %}\n                            <div class=\"ck-info-wrap\">\n                                {%= item.info.join('') %}\n                            </div>\n                            {% } %}\n\n                            {% if (item.desc.length) { %}\n                            <div class=\"ck-desc-wrap\">\n                                {%= item.desc.join('') %}\n                            </div>\n                            {% } %}\n\n                        </div>\n\n                        {% if (item.content.length) { %}\n                        <div class=\"ck-content-wrap\">\n                            {%= item.content.join('') %}\n                        </div>\n                        {% } %}\n\n                        {% if (item.meta.length) { %}\n                        <div class=\"ck-meta-wrap\">\n                            {%= item.meta.join('') %}\n                        </div>\n                        {% } %}\n\n                    </div>\n\n                    {% if (item.author || item.authorDesc.length || item.authorMeta.length) { %}\n                    <div class=\"ck-author-box\">\n\n                        {% if (item.avatar) { %}\n                            {% if (item.authorUrl) { %}\n                            <a href=\"{%= item.authorUrl %}\" class=\"ck-avatar ck-link {%= (item.authorUrlExtern ? 'ck-link-extern' : '') %}\">\n                                <img src=\"{%= item.avatar %}\"/>\n                            </a>\n                            {% } else { %}\n                            <span class=\"ck-avatar\">\n                                <img src=\"{%= item.avatar %}\"/>\n                            </span>\n                            {% } %}\n                        {% } %}\n\n                        <div class=\"ck-author-set\">\n\n                            <div class=\"ck-author-line\">\n                                {%= item.authorPrefix.join('') %}\n                                {% if (item.authorUrl) { %}\n                                <a href=\"{%= item.authorUrl %}\" class=\"ck-author ck-link {%= (item.authorUrlExtern ? 'ck-link-extern' : '') %}\">{%= item.author %}</a>\n                                {% } else { %}\n                                <span class=\"ck-author\">{%= item.author %}</span>\n                                {% } %}\n                                {%= item.authorSuffix.join('') %}\n                            </div>\n\n                            {% if (item.authorInfo.length) { %}\n                            <div class=\"ck-author-info-wrap\">\n                                {%= item.authorInfo.join('') %}\n                            </div>\n                            {% } %}\n\n                            {% if (item.authorDesc.length) { %}\n                            <div class=\"ck-author-desc-wrap\">\n                                {%= item.authorDesc.join('') %}\n                            </div>\n                            {% } %}\n\n                        </div>\n\n                        {% if (item.authorMeta.length) { %}\n                        <div class=\"ck-author-meta-wrap\">\n                            {%= item.authorMeta.join('') %}\n                        </div>\n                        {% } %}\n\n\n                    </div>\n                    {% } %}\n\n                </div>\n\n            </div>\n        {% }); %}\n        </div>\n\n    {% } else { %}\n\n        <div class=\"ck-list\">\n            <div class=\"ck-item blank\">\n                <div class=\"ck-initem\">{%=(data.config.blank || '目前还没有内容')%}</div>\n            </div>\n        </div>\n\n    {% } %}\n    </div>\n\n    {% if (data.ft) { %}\n    <footer>{%= data.ft %}</footer>\n    {% } %}\n\n</article>\n\n"}; 

});
/* @source ../cardkit/tpl/unit/list.js */;

define("../cardkit/tpl/unit/list", [], function(){

    return {"template":"\n{% function hd(){ %}\n    {% if (data.hd) { %}\n    <header class=\"ck-hd-wrap\">\n\n        <span class=\"ck-hd {%= (data.hd_url && 'clickable' || '') %}\">\n            {% if (data.hd_url) { %}\n            <a href=\"{%= data.hd_url %}\" class=\"ck-link ck-link-mask {%= (data.hd_url_extern ? 'ck-link-extern' : '') %}\"></a>\n            {% } %}\n            <span>{%= data.hd %}</span>\n        </span>\n\n        {% if (data.hd_opt) { %}\n        <div class=\"ck-hdopt-wrap\">{%=data.hd_opt%}</div>\n        {% } %}\n\n    </header>\n    {% } %}\n{% } %}\n\n{% if (data.hasSplitHd) { %}\n    {%= hd() %}\n{% } %}\n\n<article class=\"ck-unit-wrap\">\n\n    {% if (!data.hasSplitHd) { %}\n        {%= hd() %}\n    {% } %}\n\n    <div class=\"ck-list-wrap\">\n    {% if (data.items.length) { %}\n\n        <div class=\"ck-list\">\n        {% data.items.forEach(function(item, i){ %}\n            {% if (i && (i % data.config.col === 0)) { %}\n            </div><div class=\"ck-list\">\n            {% } %}\n            <div class=\"ck-item {%= (item.href && 'clickable' || '') %}\" \n                    style=\"width:{%= (data.config.col ? Math.floor(1000/data.config.col)/10 + '%' : '') %};\">\n\n                <div class=\"ck-initem\">\n\n                    {% if (item.href) { %}\n                    <a href=\"{%= item.href %}\" class=\"ck-link ck-link-mask {%= (item.hrefExtern ? 'ck-link-extern' : '') %}\"></a>\n                    {% } %}\n\n                    <div class=\"ck-title-box\">\n\n                        {%= item.opt.join('') %}\n\n                        {% if (item.icon) { %}\n                            {% if (item.hrefAlone) { %}\n                            <a href=\"{%= item.hrefAlone %}\" class=\"ck-icon ck-link {%= (item.hrefExtern ? 'ck-link-extern' : '') %}\">\n                                <img src=\"{%= item.icon %}\"/>\n                            </a>\n                            {% } else { %}\n                            <span class=\"ck-icon\">\n                                <img src=\"{%= item.icon %}\"/>\n                            </span>\n                            {% } %}\n                        {% } %}\n\n                        <div class=\"ck-title-set\">\n\n                            {% if (item.title) { %}\n                            <div class=\"ck-title-line\">\n                                {%= item.titlePrefix.join('') %}\n\n                                {% if (item.hrefAlone) { %}\n                                <a href=\"{%= item.hrefAlone %}\" class=\"ck-link {%= (item.hrefExtern ? 'ck-link-extern' : '') %}\">{%= item.title %}</a>\n                                {% } else { %}\n                                <span class=\"ck-title\">{%= item.title %}</span>\n                                {% } %}\n\n                                {%= item.titleSuffix.join('') %}\n                                {%= item.titleTag.join('') %}\n                            </div>\n                            {% } %}\n\n                            {% if (item.info.length) { %}\n                            <div class=\"ck-info-wrap\">\n                                {%= item.info.join('') %}\n                            </div>\n                            {% } %}\n\n                            {% if (item.desc.length) { %}\n                            <div class=\"ck-desc-wrap\">\n                                {%= item.desc.join('') %}\n                            </div>\n                            {% } %}\n\n                        </div>\n\n                        {% if (item.content.length) { %}\n                        <div class=\"ck-content-wrap\">\n                            {%= item.content.join('') %}\n                        </div>\n                        {% } %}\n\n                        {% if (item.meta.length) { %}\n                        <div class=\"ck-meta-wrap\">\n                            {%= item.meta.join('') %}\n                        </div>\n                        {% } %}\n\n                    </div>\n\n                    {% if (item.author || item.authorDesc.length || item.authorMeta.length) { %}\n                    <div class=\"ck-author-box\">\n\n                        {% if (item.avatar) { %}\n                            {% if (item.authorUrl) { %}\n                            <a href=\"{%= item.authorUrl %}\" class=\"ck-avatar ck-link {%= (item.authorUrlExtern ? 'ck-link-extern' : '') %}\">\n                                <img src=\"{%= item.avatar %}\"/>\n                            </a>\n                            {% } else { %}\n                            <span class=\"ck-avatar\">\n                                <img src=\"{%= item.avatar %}\"/>\n                            </span>\n                            {% } %}\n                        {% } %}\n\n                        <div class=\"ck-author-set\">\n\n                            <div class=\"ck-author-line\">\n                                {%= item.authorPrefix.join('') %}\n                                {% if (item.authorUrl) { %}\n                                <a href=\"{%= item.authorUrl %}\" class=\"ck-author ck-link {%= (item.authorUrlExtern ? 'ck-link-extern' : '') %}\">{%= item.author %}</a>\n                                {% } else { %}\n                                <span class=\"ck-author\">{%= item.author %}</span>\n                                {% } %}\n                                {%= item.authorSuffix.join('') %}\n                            </div>\n\n                            {% if (item.authorInfo.length) { %}\n                            <div class=\"ck-author-info-wrap\">\n                                {%= item.authorInfo.join('') %}\n                            </div>\n                            {% } %}\n\n                            {% if (item.authorDesc.length) { %}\n                            <div class=\"ck-author-desc-wrap\">\n                                {%= item.authorDesc.join('') %}\n                            </div>\n                            {% } %}\n\n                        </div>\n\n                        {% if (item.authorMeta.length) { %}\n                        <div class=\"ck-author-meta-wrap\">\n                            {%= item.authorMeta.join('') %}\n                        </div>\n                        {% } %}\n\n\n                    </div>\n                    {% } %}\n\n                </div>\n\n            </div>\n        {% }); %}\n        </div>\n\n    {% } else { %}\n\n        <div class=\"ck-list\">\n            <div class=\"ck-item blank\">\n                <div class=\"ck-initem\">{%=(data.config.blank || '目前还没有内容')%}</div>\n            </div>\n        </div>\n\n    {% } %}\n    </div>\n\n    {% if (data.ft) { %}\n    <footer>{%= data.ft %}</footer>\n    {% } %}\n\n</article>\n"}; 

});
/* @source ../cardkit/tpl/unit/box.js */;

define("../cardkit/tpl/unit/box", [], function(){

    return {"template":"\n{% function hd(){ %}\n    {% if (data.hd) { %}\n    <header class=\"ck-hd-wrap\">\n\n        <span class=\"ck-hd {%= (data.hd_url && 'clickable' || '') %}\">\n            {% if (data.hd_url) { %}\n            <a href=\"{%= data.hd_url %}\" class=\"ck-link ck-link-mask {%= (data.hd_url_extern ? 'ck-link-extern' : '') %}\"></a>\n            {% } %}\n            <span>{%= data.hd %}</span>\n        </span>\n\n        {% if (data.hd_opt) { %}\n        <div class=\"ck-hdopt-wrap\">{%=data.hd_opt%}</div>\n        {% } %}\n\n    </header>\n    {% } %}\n{% } %}\n\n{% if (data.config.plain || data.config.plainhd) { %}\n    {%= hd() %}\n{% } %}\n\n<article class=\"ck-unit-wrap\">\n\n    {% if (!data.config.plain && !data.config.plainhd) { %}\n        {%= hd() %}\n    {% } %}\n\n    {% if (data.hasContent) { %}\n    <section>\n        {%= data.content %}\n    </section>\n    {% } %}\n\n    {% if (data.ft) { %}\n    <footer>{%= data.ft %}</footer>\n    {% } %}\n\n</article>\n"}; 

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

/* @source ../cardkit/render.js */;


define("../cardkit/render", [
  "dollar",
  "mo/lang",
  "mo/template",
  "../cardkit/tpl/unit/box",
  "../cardkit/tpl/unit/list",
  "../cardkit/tpl/unit/mini",
  "../cardkit/tpl/unit/form",
  "../cardkit/tpl/unit/banner",
  "../cardkit/tpl/unit/blank",
  "../cardkit/tpl/layout/navdrawer",
  "../cardkit/tpl/layout/actionbar",
  "../cardkit/parser/box",
  "../cardkit/parser/list",
  "../cardkit/parser/mini",
  "../cardkit/parser/form",
  "../cardkit/parser/banner",
  "../cardkit/parser/actionbar",
  "../cardkit/parser/navdrawer"
], function($, _, tpl, 
    tpl_box, tpl_list, tpl_mini, tpl_form, tpl_banner, tpl_blank, 
    tpl_navdrawer, tpl_actionbar,
    boxParser, listParser, miniParser, formParser, 
    bannerParser, actionbarParser, navdrawerParser){

    var frame_parts = {
            'navdrawer': navdrawerParser, 
            'page-actions': actionbarParser,
            'card-actions': actionbarParser
        },
        slice = Array.prototype.slice,

        SCRIPT_TAG = 'script[type="text/cardscript"]',

        TPL_BLANK_BANNER = '<div class="ck-banner-unit"></div>';

    var exports = {

        initCard: function(card, raw, footer, opt) {

            if (!opt.isModal) {

                card.find(SCRIPT_TAG).forEach(run_script, card[0]);
                card.trigger('card:loaded', {
                    card: card
                });

                var banner_cfg = card.find('.ck-banner-unit');
                if (!banner_cfg[0]) {
                    banner_cfg = $(TPL_BLANK_BANNER);
                }
                card.prepend(banner_cfg);

            }

            var units = card.find('.ck-box-unit, .ck-mini-unit, .ck-list-unit, .ck-form-unit, .ck-banner-unit'),
                config = {
                    blank: card.data('cfgBlank')
                };

            var has_content = exports.initUnit(units, raw);

            if (!has_content && !opt.isModal && config.blank != 'false') {
                card.append(tpl.convertTpl(tpl_blank.template, {
                    config: config
                }, 'data'));
            }

            if (!opt.isModal) {

                card.append(footer.clone());

                card.trigger('card:ready', {
                    card: card
                });

            }

        },

        openCard: function(card, opt){
            if (!opt.isModal) {
                card.trigger('card:open', {
                    card: card
                });
            }
        },

        closeCard: function(card, opt){
            if (!opt.isModal) {
                card.trigger('card:close', {
                    card: card
                });
            }
        },

        initUnit: function(units, raw){
            var has_content;
            $(units).forEach(function(unit){
                var type = (/ck-(\w+)-unit/.exec(unit.className) || [])[1];
                if (type) {
                    if (exports[type](unit, raw)) {
                        has_content = true;
                    }
                }
            });
            return has_content;
        },

        banner: function(unit, raw){
            var data = bannerParser(unit, raw);
            unit.innerHTML = tpl.convertTpl(tpl_banner.template, data, 'data');
        },

        box: function(unit, raw){
            var data = boxParser(unit, raw);
            if (data.hasContent || data.hd) {
                unit.innerHTML = tpl.convertTpl(tpl_box.template, data, 'data');
                //setTimeout(function(){
                    //$('.ckd-delay-content', unit).forEach(function(tpl){
                        //this(tpl).replaceWith(tpl.innerHTML);
                    //}, $);
                //}, 100);
                return true;
            } else {
                $(unit).remove();
            }
        },

        mini: function(unit, raw){
            var data = miniParser(unit, raw);
            data.items = data.items.filter(function(item){
                if (!item.title && !item.author 
                        && (!item.content || !item.content.length)) {
                    return false;
                }
                return true;
            }, data);
            if (!data.items.length 
                    && (!data.hd || data.config.blank == 'false')) {
                $(unit).remove();
                return;
            }
            if (data.config.limit 
                    && data.config.limit < data.items.length) {
                data.items.length = data.config.limit;
            }
            unit.innerHTML = tpl.convertTpl(tpl_mini.template, data, 'data');
            return true;
        },

        list: function(unit, raw){
            var data = listParser(unit, raw);
            data.items = data.items.filter(function(item){
                var style = this.style;
                if (style === 'more' || style === 'menu') {
                    if (!item.title) {
                        return false;
                    }
                } else if (style === 'grid') {
                    if (!item.icon) {
                        return false;
                    }
                } else if (!item.title && !item.author) {
                    return false;
                }
                return true;
            }, data);
            if (data.config.limit 
                    && data.config.limit < data.items.length) {
                data.items.length = data.config.limit;
            }
            if (!data.items.length 
                    && (!data.hd || data.config.blank == 'false')) {
                $(unit).remove();
            } else {
                unit.innerHTML = tpl.convertTpl(tpl_list.template, data, 'data');
                return true;
            }
        },

        form: function(unit, raw){
            var data = formParser(unit, raw);
            if (!data.items.length 
                    && (!data.hd || data.config.blank == 'false')) {
                $(unit).remove();
            } else {
                unit.innerHTML = tpl.convertTpl(tpl_form.template, data, 'data');
                return true;
            }
        },

        _frameConfig: {},
        _frameCustomized: {},

        setFrame: function(card, header, navDrawer, raw){
            var cfg = this._frameConfig,
                customized = this._frameCustomized,
                global_cfg,
                local_cfg,
                cfg_node,
                changed = {};
            for (var part in frame_parts) {
                if (!cfg[part] || customized[part]) {
                    global_cfg = header.find('.ckcfg-' + part);
                    if (global_cfg[0]) {
                        cfg[part] = frame_parts[part](global_cfg, raw);
                        if (cfg[part]) {
                            changed[part] = true;
                        }
                    }
                }
                cfg_node = card.find('.ckcfg-' + part);
                customized[part] = !!cfg_node[0];
                if (customized[part]) {
                    local_cfg = frame_parts[part](cfg_node, raw);
                    if (local_cfg) {
                        cfg[part] = local_cfg;
                        changed[part] = true;
                    } else {
                        customized[part] = false;
                    }
                }
            }
            if (changed['card-actions']) {
                var actions = cfg['actionbar'] = cfg['card-actions'],
                    action_items = actions.items,
                    action_overflow_items = actions.overflowItems;
                action_items.push.apply(action_items, 
                    slice.call(cfg['page-actions'].items));
                action_overflow_items.push.apply(action_overflow_items, 
                    slice.call(cfg['page-actions'].overflowItems));
                action_overflow_items.unshift.apply(actions.overflowItems,
                    slice.call(action_items.splice(actions.config.limit)));
                $('.ck-top-actions').html(tpl.convertTpl(tpl_actionbar.template, cfg));
            }
            if (changed['navdrawer']) {
                navDrawer.html(tpl.convertTpl(tpl_navdrawer.template, cfg));
            }
        }
    
    };

    function run_script(script){
        new Function('', script.innerHTML).call(this);
    }

    return exports;

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

/* @source ../cardkit/bus.js */;

define("../cardkit/bus", [
  "eventmaster"
], function(Event){

    return Event();

});

/* @source ../cardkit/tpl/layout/ctlbar.js */;

define("../cardkit/tpl/layout/ctlbar", [], function(){

    return {"template":"<div class=\"ck-ctl-bar\">\n    <input type=\"button\" class=\"ck-ctl-backward\">\n    <input type=\"button\" class=\"ck-ctl-reload\">\n</div>\n"}; 

});
/* @source ../cardkit/tpl/layout/overflowmenu.js */;

define("../cardkit/tpl/layout/overflowmenu", [], function(){

    return {"template":"\n<button type=\"button\" class=\"ck-option\" value=\"{%=item.i%}\">{%=item.text%}</button>\n"}; 

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
        LOADING_DEFAULT = '加载中',

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
            this._content.empty();
            this._node.removeClass('rendered');
            this.event.fire('close', [this]);
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
        _defaults: _.merge({}, default_config, Growl.prototype._defaults),

        set: function(opt) {
            var self = this;
            self.superClass.set.call(self, opt);

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
            return this.superClass.applyOpen.apply(this, arguments);
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

/* @source ../cardkit/view/growl.js */;

define("../cardkit/view/growl", [
  "mo/lang",
  "dollar",
  "moui/growl"
], function(_, $, growl) {

    var UID = '_ckGrowlUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        var id,
            defaults = {
                corner: 'bottom'
            };
        if (elm.nodeName) {
            elm = $(elm);
            id = elm[0][UID];
            if (id && lib[id]) {
                lib[id].close();
            }
            id = elm[0][UID] = ++uid;
            opt = _.mix(defaults, elm.data(), opt);
        } else {
            opt = _.mix(defaults, elm);
        }
        opt.className = 'ck-growl';
        var g = growl(opt);
        if (id) {
            lib[id] = g;
        }
        return g;
    }

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
            loadingLabel: '稍等...'
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
                this._isLabelClose = this._label.isEmpty();
            }
            if (this._numField[0]) {
                this._isNumFieldClose = this._numField.isEmpty();
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

        val: function(v){
            if (this._field[0]) {
                if (this._field[0].nodeName === 'A') {
                    return this._field.attr('href', v);
                } else {
                    return this._field.val(v);
                }
            }
        },

        label: function(str){
            if (!this._label[0]) {
                return;
            }
            if (this._isLabelClose) {
                return this._label.val(str);
            } else {
                return this._label.html(str);
            }
        },

        num: function(n) {
            if (!this._numField[0]) {
                return;
            }
            if (this._isNumFieldClose) {
                return this._numField
                    .val(n != null ? (parseFloat(this._numField.val()) + n) : undefined);
            } else {
                return this._numField
                    .html(n != null ? (parseFloat(this._numField.html()) + n) : undefined);
            }
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
            this.val(this._config.disbleVal);
            this.num(0 - this._config.numStep);
            if (this._config.disableLabel) {
                this.label(this._config.disableLabel);
            }
            this.event.reset('enable')
                .resolve('disable', [this]);
            return this;
        }
    
    };

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

        addOption: function(elm){
            elm = $(elm)[0];
            if (elm[OID]) {
                return;
            }
            elm[OID] = ++this._uoid;
            var controller = control(elm, {
                enableVal: elm.value,
                label: false
            });
            controller.event.bind('enable', when_enable.bind(this))
                .bind('disable', when_disable.bind(this));
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

        val: function(){
            if (!this._config) {
                return;
            }
            if (this._config.multiselect) {
                return this._allSelected.map(function(controller){
                    return controller.val();
                });
            } else {
                if (this._lastSelected) {
                    return this._lastSelected.val();
                }
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
                    controller.enable();
                });
            }
            this._lastActionTarget = null;
            return this;
        },

        unselectAll: function(){
            if (this._config.multiselect) {
                this._options.forEach(function(controller){
                    controller.disable();
                });
                this._lastActionTarget = null;
            } else {
                this.undo();
            }
            return this;
        },

        selectInvert: function(){
            if (this._config.multiselect) {
                this._options.forEach(function(controller){
                    controller.toggle();
                });
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
            if (this._config.multiselect) {
                this._allSelected.push(controller);
            } else {
                var last = this._lastSelected;
                this._lastSelected = controller;
                if (last) {
                    last.disable();
                }
            }
        } else {
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
            confirmText: '确认',
            cancelText: '取消',
            options: null,
            multiselect: false
        };

    var ActionView = _.construct(overlay.Overlay);

    mix(ActionView.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: _.merge({}, default_config, ActionView.prototype._defaults),

        init: function(opt) {
            this.superClass.init.call(this, opt);
            this._wrapper = this._node.find('.wrapper').eq(0);
            this._actionsWrapper = this._content;
            this._wrapperContent = this._wrapper.find('.content').eq(0);
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
            this.superClass.set.call(this, opt);

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
            this.superClass.applyOpen.apply(this, arguments);
        },

        applyClose: function(){
            if (!this._config.multiselect && this._picker) {
                this._picker.event.reset();
            }
            this.superClass.applyClose.apply(this, arguments);
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

/* @source ../cardkit/view/actionview.js */;

define("../cardkit/view/actionview", [
  "mo/lang",
  "dollar",
  "moui/actionview",
  "../cardkit/bus"
], function(_, $, actionView, bus) {

    var UID = '_ckActionViewUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        var id = elm;
        if (typeof elm === 'object') {
            elm = $(elm);
            id = elm[0][UID];
        } else {
            elm = false;
        }
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        if (elm) {
            id = elm[0][UID] = ++uid;
        }
        opt = opt || {};
        opt.className = 'ck-actionview';
        var view = lib[id] = actionView(opt);
        var eprops = {
            component: view
        };
        view.event.bind('prepareOpen', function(view){
            exports.current = view;
            bus.fire('actionView:prepareOpen', [view]);
        }).bind('cancelOpen', function(view){
            exports.current = null;
            bus.fire('actionView:cancelOpen', [view]);
        }).bind('open', function(view){
            bus.fire('actionView:open', [view]);
            if (elm) {
                elm.trigger('actionView:open', eprops);
            }
        }).bind('close', function(){
            exports.current = null;
            bus.unbind('actionView:confirmOnThis');
            bus.fire('actionView:close', [view]);
            if (elm) {
                elm.trigger('actionView:close', eprops);
            }
        }).bind('cancel', function(){
            if (elm) {
                elm.trigger('actionView:cancel', eprops);
            }
        }).bind('confirm', function(view, picker){
            bus.fire('actionView:confirmOnThis', [view]);
            if (elm) {
                elm.trigger('actionView:confirm', eprops);
            }
            if (picker && picker._lastSelected) {
                var target = picker._lastSelected._node.attr('target');
                if (target) {
                    bus.fire('actionView:jump', [view, picker.val(), target]);
                }
            }
        });
        return view;
    }

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
                        <button type="button" class="confirm" data-is-default="true"></button>\
                        <button type="button" class="cancel"></button>\
                        <h1></h1>\
                    </header>\
                    <article><div class="content"></div></article>\
                </div>\
            </div>',

        default_config = {
            className: 'moui-modalview',
            iframe: false,
            hideConfirm: false,
            confirmText: '确认',
            cancelText: '取消'
        };


    var ModalView = _.construct(overlay.Overlay);

    mix(ModalView.prototype, {

        _ns: NS,
        _template: TPL_VIEW,
        _defaults: _.merge({}, default_config, ModalView.prototype._defaults),

        init: function(opt) {
            this.superClass.init.call(this, opt);
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
            self.superClass.set.call(self, opt);

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
            this.superClass.setContent.call(this, html);
            if (html) {
                this.event.fire('contentchange', [this]);
            }
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
            this.superClass.applyOpen.apply(this, arguments);
            if (this._config.iframe) {
                this._iframeContent.attr('src', this._config.iframe);
            }
        },

        applyClose: function(){
            this._clearIframeContent();
            this._contentWrapper[0].scrollTop = 0;
            this.superClass.applyClose.apply(this, arguments);
        }

    });

    ModalView.prototype.done = ModalView.prototype.ok;

    function exports(opt) {
        return new exports.ModalView(opt);
    }

    exports.ModalView = ModalView;

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
            contentType: s.contentType === false? false : (s.contentType || "application/x-www-form-urlencoded"),
            username: s.username || null,
            password: s.password || null,
            timeout: s.timeout || 0,
            processData: s.processData === undefined ? true : s.processData,
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
            if ( options.data && options.contentType !== false )
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
                return !r.status && location.protocol == "file:" || ( r.status >= 200 && r.status < 300 ) || r.status == 304 || r.status == 1223 || browsers.safari && !r.status;
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

    exports.parseJSON = function(json){
        json = json
            .replace(/^[\w(<\/*!\s]*?\{/, '{')
            .replace(/[^\}]*$/, '');
        try {
            json = window.JSON ? window.JSON.parse(json) : eval(json);
        } catch(ex) {
            json = false;
        }
        return json;
    };

});

/* @source ../cardkit/view/modalcard.js */;

define("../cardkit/view/modalcard", [
  "dollar",
  "mo/network",
  "moui/modalview",
  "../cardkit/supports"
], function($, net, modal, supports) {

    var modalCard = modal({
            className: 'ck-modalview',
            closeDelay: 400
        }),
        _content_filter,
        origin_set_content = modalCard.setContent,
        origin_set = modalCard.set;

    modalCard.set = function(opt){
        if (!opt) {
            return this;
        }
        var self = this,
            url = opt.jsonUrl || opt.url;
        if (url) {
            opt.content = '';
            self.showLoading();
            net.ajax({
                url: url,
                dataType: opt.jsonUrl ? 'json' : 'text',
                success: function(data){
                    if (opt.jsonUrl) {
                        data = data.html;
                    }
                    self.setContent(data);
                    self.hideLoading();
                }
            });
        }

        _content_filter = opt.contentFilter;

        if (opt.iframeUrl) {
            opt.iframe = opt.iframeUrl;
        }

        if (opt.source) {
            opt.content = $('.' + opt.source).map(function(elm){
                var type = $(elm).attr('type');
                if (type === 'text/cardscript' || type === 'text/jscode') {
                    return '<script>' + elm.innerHTML + '</script>';
                } else {
                    return elm.innerHTML;
                }
            }).join('');
        }

        return origin_set.call(this, opt);
    };

    modalCard.setContent = function(html){
        if (_content_filter) {
            html = (new RegExp(_content_filter).exec(html) || [])[1];
        }
        return origin_set_content.call(this, html);
    };
    
    if (supports.BROWSER_CONTROL) {
        modalCard.ok = modalCard.done = function(){
            history.back();
            return this.event.promise('close');
        };
    }

    modalCard.event.bind('confirm', function(modal){
        modal.event.fire('confirmOnThis', arguments);
    }).bind('close', function(modal){
        modal.event.unbind('confirmOnThis');
    });

    return modalCard;

});

/* @source moui/slider.js */;

define('moui/slider', [
  "mo/lang",
  "dollar",
  "eventmaster"
], function(_, $, event) {
    function Slider(elm, opt) {
        this.init(elm, opt);
    }

    Slider.prototype = {
        init: function(elm) {
            var node = this._node = $(elm),
                field;

            this.event = event();

            if (node.data('init')) {
                return;
            } else {
                node.data('init', true);
            }

            this._field = field = node.find('.slider-field');
            this._hoverArea = node.find('.slider-hover');
            this._selectedArea = node.find('.slider-selected');

            this._step = field.attr('step'),
            this._max = field.attr('max'),
            this._min = field.attr('min');

            this._stepWidth = this._step * node.width() / (this._max - this._min);
        },

        calc: function(event) {
            var pageX = (event.changedTouches) ? event.changedTouches[0].pageX : event.pageX,
                node = this._node,
                stepWidth = this._stepWidth,
                step = this._step,
                offsetX = pageX - node.offset().left;

            if (offsetX > node.width()) {
                offsetX = node.width();
            } else if (offsetX < 0) {
                offsetX = 0;
            }

            return Math.ceil(offsetX / stepWidth) * step;
        },

        val: function(v) {
            if (this._field[0]) {
                var returnValue = this._field.val(v);
                if (v !== undefined) {
                    this.event.fire('change');
                }
                return returnValue;
            }
        },

        show: function(v) {
            var stepWidth = this._stepWidth,
                selectedArea = this._selectedArea,
                hoverArea = this._hoverArea;

            hoverArea.hide();
            selectedArea.css({width:v * stepWidth})
                .show();
        },

        pretend: function(v) {
            var stepWidth = this._stepWidth,
                selectedArea = this._selectedArea,
                hoverArea = this._hoverArea;

            var width = v * stepWidth;

            if (hoverArea.data('width') != width) {
                selectedArea.hide();
                hoverArea.css({width: width})
                    .show()
                    .data('width', width);
            }
        }
    };

    function exports(elm, opt){
        return new exports.Slider(elm, opt);
    }

    exports.Slider = Slider;

    return exports;

});

/* @source ../cardkit/view/stars.js */;

define("../cardkit/view/stars", [
  "mo/lang",
  "dollar",
  "mo/network",
  "moui/slider"
], function(_, $, net, slider) {
    var UID = '_ckStarsUid',
        uid = 0,
        lib = {};

    function exports(elm) {
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id];
        }
        id = elm[0][UID] = ++uid;
        var s = lib[id] = slider(elm);

        s.event.bind('change', function() {
            var value = s.val();
            s.show(value);
        });

        return s;
    }

    exports.gc = function(check) {
        for (var i in lib) {
            if (check(lib[i])) {
                delete lib[i];
            }
        }
    };

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

/* @source ../cardkit/view/ranger.js */;

define("../cardkit/view/ranger", [
  "dollar",
  "moui/ranger",
  "../cardkit/bus",
  "../cardkit/view/growl"
], function($, ranger, bus, growl){

    var UID = '_ckRangerUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        opt = opt || {};
        var p = lib[id] = ranger(elm, opt);
        p.notify = growl({
            parent: elm.parent(),
            corner: 'stick'
        });
        p.event.bind('change', function(v){
            p.notify.set({
                content: v
            }).open();
        }).bind('changed', function(){
            var url = elm.trigger('ranger:changed', {
                component: p
            }).data('url');
            bus.fire('ranger:changed', [p, url]);
        }).bind('changeEnd', function(){
            p.notify.close();
        });

        return p;
    }

    return exports;

});

/* @source ../cardkit/view/picker.js */;

define("../cardkit/view/picker", [
  "mo/lang",
  "dollar",
  "mo/network",
  "moui/picker"
], function(_, $, net, picker) {

    var UID = '_ckPickerUid',
    
        uid = 0,
        lib = {};

    function request(cfg, fn){
        var url = cfg.jsonUrl || cfg.url;
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
                success: fn
            });
        } else {
            fn(false);
        }
    }

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        opt = _.mix({
            options: '.ck-option'
        }, opt || {});
        var p = lib[id] = picker(elm, opt);

        p.event.bind('change', function(p, controller){
            var cfg = controller.data(), 
                eprops = {
                    component: p 
                },
                req_opt;
            p.showLoading();
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
            request(req_opt, function(data){
                p.hideLoading();
                if (data !== false) {
                    p.responseData = data;
                    elm.trigger('picker:response', eprops);
                }
            });
            elm.trigger('picker:change', eprops);
        });

        return p;
    }

    exports.gc = function(check){
        for (var i in lib) {
            if (check(lib[i])) {
                delete lib[i];
            }
        }
    };

    return exports;

});

/* @source ../cardkit/view/control.js */;

define("../cardkit/view/control", [
  "mo/lang",
  "dollar",
  "mo/network",
  "moui/control"
], function(_, $, net, control) {

    var UID = '_ckControlUid',
    
        uid = 0,
        lib = {};

    var CkControl = _.construct(control.Control);

    _.mix(CkControl.prototype, {

        enable: function(){
            var cfg = this.data();
            return this.request({
                method: cfg.enableMethod,
                url: cfg.enableUrl,
                jsonUrl: cfg.enableJsonUrl
            }, function(){
                this.superClass.enable.call(this);
            });
        },

        disable: function(){
            var cfg = this.data();
            return this.request({
                method: cfg.disableMethod,
                url: cfg.disableUrl,
                jsonUrl: cfg.disableJsonUrl
            }, function(){
                this.superClass.disable.call(this);
            });
        },

        request: function(cfg, fn){
            var self = this,
                url = cfg.jsonUrl || cfg.url;
            if (url) {
                var data;
                url = url.replace(/\?(.+)$/, function($0, $1) {
                    data = $1.replace(/#.*/, '');
                    return '';
                });
                self.showLoading();
                net.ajax({
                    url: url,
                    data: data,
                    type: cfg.method || 'post',
                    dataType: cfg.jsonUrl ? 'json' : 'text',
                    success: function(data){
                        self.hideLoading();
                        self.responseData = data;
                        fn.call(self);
                    }
                });
            } else {
                fn.call(self);
            }
            return this;
        }
    
    });

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        var controller = lib[id] = new exports.Control(elm, opt);
        controller.event.bind('enable', function(controller){
            elm.trigger('control:enable', {
                component: controller
            });
        }).bind('disable', function(controller){
            elm.trigger('control:disable', {
                component: controller
            });
        });
        return controller;
    }

    exports.Control = CkControl;

    exports.gc = function(check){
        for (var i in lib) {
            if (check(lib[i])) {
                delete lib[i];
            }
        }
    };

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

/* @source mo/easing/base.js */;


define("mo/easing/base", [], function(){

    return {

        def: 'ease',

        positions: {
            'linear'         :  [0.250, 0.250, 0.750, 0.750],
            'ease'           :  [0.250, 0.100, 0.250, 1.000],
            'easeIn'         :  [0.420, 0.000, 1.000, 1.000],
            'easeOut'        :  [0.000, 0.000, 0.580, 1.000],
            'easeInOut'      :  [0.420, 0.000, 0.580, 1.000]
        },

        values: {
            linear: 'linear',
            ease: 'ease',
            easeIn: 'ease-in',
            easeOut: 'ease-out',
            easeInOut: 'ease-in-out'
        },

        // http://gsgd.co.uk/sandbox/jquery/easing/
        // t: current time, b: begInnIng value, c: change In value, d: duration
        functions: {
            linear: function(x, t, b, c) {
                return b + c * x;
            },
            ease: function(x, t, b, c) {
                return ((-Math.cos(x*Math.PI)/2) + 0.5) * c + b;
            },
            easeIn: function (x, t, b, c, d) {
                return c*(t /= d)*t + b;
            },
            easeOut: function (x, t, b, c, d) {
                return -c *(t /= d)*(t-2) + b;
            },
            easeInOut: function (x, t, b, c, d) {
                if ((t /= d/2) < 1) return c/2*t*t + b;
                return -c/2 * ((--t)*(t-2) - 1) + b;
            }
        },

    };

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
  "mo/easing/base",
  "mo/mainloop",
  "eventmaster"
], function(es5, _, easing, mainloop, Event){

    var window = this,
        VENDORS = ['Moz', 'webkit', 'ms', 'O', ''],
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
        RE_PROP_SPLIT = /\)\s+/,
        RE_UNIT = /^[\-\d\.]+/,
        test_elm = window.document.body,
        _array_slice = Array.prototype.slice,
        _getComputedStyle = (document.defaultView || {}).getComputedStyle,
        vendor_prop = { 'transform': '', 'transition': '' },
        useCSS = false,
        hash_id = 0,
        stage_id = 0,
        render_id = 0,
        _stage = {},
        _transition_sets = {},
        _transform_promise = {},
        timing_values = easing.values,
        timing_functions = easing.functions;

    function fix_prop_name(lib, prefix, true_prop, succ){
        for (var prop in lib) {
            true_prop = prefix ? ('-' + prefix + '-' + prop) : prop;
            if (css_method(true_prop) in test_elm.style) {
                lib[prop] = true_prop;
                if (!TRANSIT_EVENT && prop === 'transition') {
                    TRANSIT_EVENT = EVENT_NAMES[prefix];
                }
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
    //fix_prop_name(vendor_prop, '');

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

        group: function(){
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
        if (e.target !== this) {
            return;
        }
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

        VERSION: '1.0.5',
        renderMode: useCSS ? 'css' : 'js',
        Stage: Stage,
        Actor: Actor,

        config: function(opt){
            if (opt.easing) {
                _.mix(timing_values, opt.easing.values);
                _.mix(timing_functions, opt.easing.functions);
                if (mainloop) {
                    mainloop.config({ easing: timing_functions });
                }
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

/* @source mo/easing/timing.js */;


define("mo/easing/timing", [
  "mo/lang/mix",
  "mo/easing/base"
], function(_, base){

    // Penner Equations (approximated)
    // http://matthewlein.com/ceaser/
    var pos = {
        'easeInQuad'     :  [0.550, 0.085, 0.680, 0.530],
        'easeInCubic'    :  [0.550, 0.055, 0.675, 0.190],
        'easeInQuart'    :  [0.895, 0.030, 0.685, 0.220],
        'easeInQuint'    :  [0.755, 0.050, 0.855, 0.060],
        'easeInSine'     :  [0.470, 0.000, 0.745, 0.715],
        'easeInExpo'     :  [0.950, 0.050, 0.795, 0.035],
        'easeInCirc'     :  [0.600, 0.040, 0.980, 0.335],
        'easeInBack'     :  [0.600, -0.280, 0.735, 0.045],
        'easeOutQuad'    :  [0.250, 0.460, 0.450, 0.940],
        'easeOutCubic'   :  [0.215, 0.610, 0.355, 1.000],
        'easeOutQuart'   :  [0.165, 0.840, 0.440, 1.000],
        'easeOutQuint'   :  [0.230, 1.000, 0.320, 1.000],
        'easeOutSine'    :  [0.390, 0.575, 0.565, 1.000],
        'easeOutExpo'    :  [0.190, 1.000, 0.220, 1.000],
        'easeOutCirc'    :  [0.075, 0.820, 0.165, 1.000],
        'easeOutBack'    :  [0.175, 0.885, 0.320, 1.275],
        'easeInOutQuad'  :  [0.455, 0.030, 0.515, 0.955],
        'easeInOutCubic' :  [0.645, 0.045, 0.355, 1.000],
        'easeInOutQuart' :  [0.770, 0.000, 0.175, 1.000],
        'easeInOutQuint' :  [0.860, 0.000, 0.070, 1.000],
        'easeInOutSine'  :  [0.445, 0.050, 0.550, 0.950],
        'easeInOutExpo'  :  [1.000, 0.000, 0.000, 1.000],
        'easeInOutCirc'  :  [0.785, 0.135, 0.150, 0.860],
        'easeInOutBack'  :  [0.680, -0.550, 0.265, 1.550]
    };

    function stringify(pos, values){
        values = values || {};
        for (var i in pos) {
            values[i] = 'cubic-bezier(' + pos[i].join(',') + ')';
        }
        return values;
    }

    pos.swing = pos.jswing = base.positions.ease;

    return {
        positions: _.mix(pos, base.positions),
        values: _.mix(stringify(pos), base.values),
        stringify: stringify
    };

});

/* @source mo/cookie.js */;

/**
 * using AMD (Asynchronous Module Definition) API with OzJS
 * see http://ozjs.org for details
 *
 * Copyright (C) 2010-2012, Dexter.Yy, MIT License
 * vim: et:ts=4:sw=4:sts=4
 */
define("mo/cookie", [], function(){

    return function(win, n, v, op){
        if(typeof win == "string") {
            op = v;
            v = n;
            n = win;
            win = window;
        }
        if(v !== undefined) {
            op = op || {};
            var date, expires = "";
            if(op.expires) {
                if(op.expires.constructor == Date) {
                    date = op.expires;
                } else {
                    date = new Date();
                    date.setTime(date.getTime() + (op.expires * 24 * 60 * 60 * 1000));
                }
                expires = '; expires=' + date.toGMTString();
            }
            var path = op.path ? '; path=' + op.path : '';
            var domain = op.domain ? '; domain=' + op.domain : '';
            var secure = op.secure ? '; secure' : '';
            win.document.cookie = [n, '=', encodeURIComponent(v), expires, path, domain, secure].join('');
        } else {
            v = win.document.cookie.match( new RegExp( "(?:\\s|^)" + n + "\\=([^;]*)") );
            return v ? decodeURIComponent(v[1]) : null;
        }
    };

});


/* @source ../cardkit/app.js */;

define("../cardkit/app", [
  "dollar",
  "mo/lang",
  "mo/browsers",
  "mo/cookie",
  "mo/template",
  "mo/easing/timing",
  "soviet",
  "choreo",
  "momo/base",
  "momo/tap",
  "momo/swipe",
  "momo/scroll",
  "../cardkit/view/control",
  "../cardkit/view/picker",
  "../cardkit/view/ranger",
  "../cardkit/view/stars",
  "../cardkit/view/modalcard",
  "../cardkit/view/actionview",
  "../cardkit/view/growl",
  "../cardkit/tpl/layout/overflowmenu",
  "../cardkit/tpl/layout/ctlbar",
  "../cardkit/bus",
  "../cardkit/render",
  "../cardkit/supports",
  "cardkit/env",
  "mo/domready"
], function($, _, browsers, cookie, tpl, easing, soviet, choreo, 
    momoBase, momoTap, momoSwipe, momoScroll, 
    //momoDrag,
    control, picker, ranger, stars, modalCard, actionView, growl, 
    tpl_overflowmenu, tpl_ctlbar, 
    bus, render, supports, env){

    var window = this,
        history = window.history,
        location = window.location,
        document = window.document,
        body = document.body,
        last_view_for_modal,
        last_view_for_actions,
        gc_id = 0,
        soviet_aliases = {},

        HASH_SEP = '!/',
        CLEARED_HASH = '#' + HASH_SEP + 'i',
        DEFAULT_CARDID = 'ckDefault',
        LOADING_CARDID = 'ckLoading',
        MODAL_CARDID = '_modal_',
        MINI_ITEM_MARGIN = 10,
        MINI_LIST_PADDING = 15,

        TPL_NAVDRAWER = '<div class="ck-navdrawer"></div>',
        TPL_MASK = '<div class="ck-viewmask"></div>',
        TPL_CARD_MASK = '<div class="ck-cardmask"></div>';

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
            $(e.target).trigger(ev, e);
            return this;
        }
    });

    var tap_events = {

        'a': link_handler,
        'a *': link_handler,

        //'.ck-link-mask': function(){
            //clear_active_item_mask(ck.viewport);
        //},
        
        '.ck-link-img': function(){
            var src = $(this).attr('src');
            if (src) {
                ck.openImage(src);
            }
        },

        '.ck-confirm-link': function(){
            var me = $(this);
            if (!this.href) {
                me = me.parent();
            }
            ck.confirm('', function(){
                open_url(me.attr('href'), me);
            }, me.data());
        },

        '.ck-post-link': handle_control,

        '.ck-post-button, .ck-post-button span': tap_ck_post,

        '.ck-switch, .ck-switch span': tap_ck_switch,

        '.ck-segment .ck-option, .ck-segment .ck-option span': function(){
            var btn = $(this);
            if (!btn.hasClass('ck-option')) {
                btn = btn.closest('.ck-option');
            }
            var p = picker(btn.parent());
            p.select(btn);
        },

        '.ck-tagselector .ck-option': function(){
            var p = picker(this.parentNode);
            p.select(this);
        },

        '.ck-actions .ck-option': function(){
            var actions = $(this).closest('.ck-actions');
            var p = picker(actions, {
                ignoreStatus: actions.data("ignoreStatus") !== 'false' && true
            });
            p.select(this);
        },

        '.ck-folder header': function(){
            control(this.parentNode).toggle();
        },

        '.ck-select, .ck-select span, .ck-select .enabled': function(){
            var me = $(this);
            if (!me.hasClass('ck-select')) {
                me = me.parent();
            }
            var p = picker(me);
            show_actions(me);
            bus.bind('actionView:confirmOnThis', function(actions){
                p.select(actions.val());
            });
        },

        '.ck-actions-button, .ck-actions-button span': function(){
            var me = $(this);
            if (!me.hasClass('ck-actions-button')) {
                me = me.parent();
            }
            show_actions(me);
        },

        '.ck-modal-button': open_modal_card,
        '.ck-modal-link': open_modal_card,

        '.ck-growl-button': function(){
            growl(this).open();
        },

        '.ck-actionview article > .ck-option': function(){
            actionView.current.select(this);
        },

        '.ck-actionview > footer .confirm': function(){
            actionView.current.confirm();
        },

        '.ck-actionview > footer .cancel': function(){
            actionView.current.cancel();
        },

        '.ck-modalview .wrapper > header .confirm': function(){
            modalCard.confirm();
        },

        '.ck-modalview .wrapper > header .cancel': function(){
            modalCard.cancel();
        },

        '.ck-ctl-backward': function(){
            if (ck.viewport[0].id === DEFAULT_CARDID) {
                back_handler(LOADING_CARDID);
            } else {
                back_handler(ck.viewport.data('prevCard') || DEFAULT_CARDID);
            }
        },

        '.ck-ctl-reload': function(){
            window.location.reload();
        },

        '.ck-top-overflow': function(){
            var selector = '.ck-top-overflow-items .ck-item,'
                    + '.ck-top-overflow-items .ck-overflow-item',
                options = $(selector).map(function(item, i){
                    return $(tpl.convertTpl(this, {
                        i: i,
                        text: $(item).html()
                    }, 'item'))[0];
                }, tpl_overflowmenu.template);
            actionView(this, {
                options: options
            }).open();
            bus.bind('actionView:confirmOnThis', function(actionCard){
                var i = actionCard.val();
                bus.once('actionView:close', function(){
                    $(selector).eq(i).trigger('tap');
                });
            });
        },

        '.ck-top-title': function(){
            if (supports.FULLSCREEN_MODE) {
                $('.ck-top-nav').trigger('tap');
            } else {
                return true;
            }
        },

        '.ck-top-nav, .ck-top-nav span': function(){
            if (this.href) {
                return;
            }
            ck.openNavDrawer();
        }

    };

    function open_modal_card(){
        ck.openModal($(this).data());
    }

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
        var controller = control(this).toggle();
        mark_gc(controller);
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

    function respond_stars(e, method) {
        var rater = stars(this),
            score = rater.calc(e);
        rater[method](score);
    }

    function mark_gc(com){
        if (!com.parentId) {
            com.parentId = ++gc_id;
        }
        ck.viewportGarbage[com.parentId] = 1;
    }

    bus.bind('cardkit:updateSize', function(){
        if (modalCard.isOpened) {
            var current = modalCard._contentWrapper;
            var h = window.innerHeight * 2;
            if (modalCard._iframeContent) {
                modalCard._iframeContent.css({
                    minHeight: h + 'px',
                    width: current[0].offsetWidth + 'px',
                    height: current[0].offsetHeight - ck.headerHeight + 'px'
                });
            }
            modalCard._content.css('minHeight', h + 'px');
        }
        var actionCard = actionView.current;
        if (actionCard) {
            var wh = window.innerHeight + 10,
                h = actionCard._wrapperContent.children().map(function(node){
                    return node.offsetHeight || 0;
                }).reduce(function(a, b){
                    return a + b;
                }) + parseFloat(actionCard._wrapperContent
                    .find('article').eq(0).css('bottom'));
            if (h < wh) {
                h = wh;
            }
            actionCard._wrapperContent.css({
                minHeight: h + 'px'
            });
            actionCard._node.css({
                height: h + 'px'
            });
        }
    });

    modalCard.event.bind('prepareOpen', function(){
        ck.disableView = true;
        if (!supports.CARD_SCROLL) {
            ck.resetWindowTop();
        } else {
            $(body).addClass('bg').addClass('modal-view');
        }
    }).bind('cancelOpen', function(){
        ck.disableView = false;
        $(body).removeClass('bg').removeClass('modal-view');
    }).bind('open', function(){
        if (!supports.CARD_SCROLL) {
            $(body).addClass('bg').addClass('modal-view');
        }
        var current = modalCard._contentWrapper;
        last_view_for_modal = ck.viewport;
        ck.changeView(current, { 
            isModal: true 
        });
        if (modalCard._iframeContent) {
            modalCard.event.done('frameOnload', function(){
                var iframe_body = $(modalCard._iframeWindow[0].document.body);
                iframe_body.bind('touchstart', prevent_window_scroll);
                ck.initView(iframe_body, {
                    isModal: true
                });
                setTimeout(function(){
                    ck.enableControl();
                }, 400);
            });
        } else if (!modalCard._content.html()) { // @TODO 换更靠谱的方法
            modalCard.event.done('contentchange', function(){
                ck.initView(current, {
                    isModal: true
                });
                setTimeout(function(){
                    ck.enableControl();
                }, 400);
            });
        } else {
            setTimeout(function(){
                ck.enableControl();
            }, 400);
        }
    }).bind('prepareClose', function(){
        ck.disableView = false;
        $(body).removeClass('modal-view');
    }).bind('cancelClose', function(){
        ck.disableView = true;
        $(body).addClass('modal-view');
    }).bind('close', function(){
        ck.changeView(last_view_for_modal, {
            preventRender: ck._navDrawerLastView,
            isModal: ck._navDrawerLastView,
            isNotPrev: true
        });
        $(body).removeClass('bg');
    //}).bind('needclose', function(){
        //ck.closeModal();
    });

    bus.bind('actionView:prepareOpen', function(actionCard){
        ck.disableView = true;
        var current = actionCard._wrapper;
        last_view_for_actions = ck.viewport;
        current[0].scrollTop = 0;
        ck.changeView(current, {
            preventRender: true,
            preventScroll: true,
            isActions: true
        });
        if (!supports.CARD_SCROLL) {
            $(body).addClass('bg');
        }
    }).bind('actionView:cancelOpen', function(){
        if (!modalCard.isOpened) {
            ck.disableView = false;
        }
        if (!supports.CARD_SCROLL) {
            $(body).removeClass('bg');
        }
        ck.changeView(last_view_for_actions, {
            isNotPrev: true,
            preventRender: modalCard.isOpened || ck._navDrawerLastView,
            preventScroll: true,
            isModal: modalCard.isOpened || ck._navDrawerLastView
        });
    }).bind('actionView:close', function(){
        if (!modalCard.isOpened) {
            ck.disableView = false;
        }
        if (!supports.CARD_SCROLL) {
            $(body).removeClass('bg');
        }
        ck.changeView(last_view_for_actions, {
            isNotPrev: true,
            preventRender: modalCard.isOpened || ck._navDrawerLastView,
            preventScroll: true,
            isModal: modalCard.isOpened || ck._navDrawerLastView
        });
    }).bind('actionView:jump', function(actionCard, href, target){
        actionCard.event.once('close', function(){
            ck.openURL(href, { target: target });
        });
    });

    bus.bind('ranger:changed', function(ranger, url){
        if (url) {
            open_url(tpl.format(url, {
                value: ranger.val()
            }));
        }
    });

    var ck = {

        init: function(opt){
            var doc = $(document);
            var root = this.root = opt.root;
            this.mainview = $('.ck-main', root);
            this.wrapper = $('.ck-wrapper', root);
            this.header = $('.ck-header', root);
            if (!supports.BROWSER_CONTROL) {
                this.ctlbar = $(tpl_ctlbar.template).appendTo(this.wrapper);
                $(body).addClass('has_ctlbar');
            }
            this.footer = $('.ck-footer', root);
            this.raw = $('.ck-raw', root);
            this.loadingCard = $('#' + LOADING_CARDID).data('rendered', '1');
            this.defaultCard = $('#' + DEFAULT_CARDID);
            this.scrollMask = $(TPL_MASK).appendTo(body);
            if (env.showScrollMask) {
                this.scrollMask.css({
                    'opacity': '0.2',
                    'background': '#f00'
                });
            }
            this.controlMask = $(TPL_MASK).appendTo(body);
            if (env.showControlMask) {
                this.controlMask.css({
                    'opacity': '0.2',
                    'background': '#0f0'
                });
            }
            this.cardMask = $(TPL_CARD_MASK).appendTo(this.mainview);
            this.navDrawer = $(TPL_NAVDRAWER).prependTo(root);
            this.headerHeight = this.header.height();
            this.sizeInited = false;
            this.viewportGarbage = {};
            this._sessionLocked = true;
            this._unexpectStateWhenGoback = true;

            this.initWindow();

            if (env.enableConsole) {
                console.info('Features:', supports);
                console.info('Platform:', browsers);
            }

            choreo.config({
                easing: easing
            });

            this.scrollGesture = momoScroll(document, {});
            set_alias_events(this.scrollGesture.event);
            var tapGesture = momoTap(document, {
                tapThreshold: browsers.os !== 'android' 
                    || !browsers.chrome && 20 
                    || 0
            });
            set_alias_events(tapGesture.event);
            var swipeGesture = momoSwipe(this.wrapper, {
                timeThreshold: 10000,
                distanceThreshold: 10 
            });
            set_alias_events(swipeGesture.event);
            //var dragGesture = momoDrag(this.mainview);
            //set_alias_events(dragGesture.event);

            if (!supports.CARD_SCROLL) {
                $(body).addClass('no-cardscroll');
            }
            if (!supports.SAFARI_OVERFLOWSCROLL) {
                $(body).addClass('no-overflowscroll');
            }
            if (supports.FOLDABLE_URLBAR) {
                $(body).addClass('mobilesafari-bar');
            }
            if (supports.FIXED_BOTTOM_BUGGY) {
                $(body).addClass('fixed-bottom-buggy');
            }
            if (supports.FULLSCREEN_MODE) {
                $(body).addClass('fullscreen-mode');
            }

            this.initState();

            $(window).bind('resize', function(){
                var current = ck.isLandscape();
                if (current !== ck.landscapeMode) {
                    ck.initWindow();
                    ck.hideAddressbar(); // @TODO 无效
                    if (actionView.current 
                            && !supports.CARD_SCROLL) {
                        ck.viewport[0].innerHTML = ck.viewport[0].innerHTML;
                    }
                }
            });

            this.cardMask.bind('touchstart', function(e){
                e.preventDefault();
                ck.closeNavDrawer();
            });

            this.loadingCard.bind('touchstart', function(e){
                e.preventDefault();
            });

            soviet(document, {
                aliasEvents: soviet_aliases,
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': nothing,
                'a *': nothing
            //}).on('tapstart', {
                //'.ck-link-mask': function(){
                    //$(this).addClass('ck-link-mask-active');
                //}
            //}).on('tapcancel', {
                //'.ck-link-mask': function(){
                    //clear_active_item_mask(ck.viewport);
                //}
            }).on('change', {
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
                },
                '.ck-stars': function(e) {
                    respond_stars.call(this, e, 'val');
                },
                '.ck-stars .slider-selected': function(e) {
                    respond_stars.call(this.parentNode, e, 'val');
                }
            }).on('touchmove', {
                '.ck-stars': function(e) {
                    respond_stars.call(this, e, 'pretend');
                },
                '.ck-stars .slider-selected': function(e) {
                    respond_stars.call(this.parentNode, e, 'pretend');
                }
            }).on('tap', tap_events);

            doc.bind('scrolldown', function(){
                if (topbar_holded) {
                    return;
                }
                setTimeout(function(){
                    ck.hideAddressbar();
                }, 0);
                //if (ck.viewport[0].scrollTop >= ck.headerHeight) {
                    //ck.hideTopbar();
                //} else {
                    //$(document).bind('touchmove', delay_hide_topbar)
                        //.bind('touchend', delay_hide_topbar);
                //}
            //}).bind('scrollup', function(){
                //ck.showTopbar();
            });
            
            var wrapper_delegate = soviet(this.wrapper, {
                aliasEvents: soviet_aliases,
                matchesSelector: true
            }).on('swipeleft', {
                '.ck-mini-unit .ck-list-wrap *': function(){
                    stick_item.call(this, true);
                }
            }).on('swiperight', {
                '.ck-mini-unit .ck-list-wrap *': function(){
                    stick_item.call(this, false);
                }
            });

            //init_card_drag();

            if (!supports.SAFARI_OVERFLOWSCROLL) {

                wrapper_delegate.on('touchend', {
                    '.ck-mini-unit .ck-list-wrap *': function(e){
                        e.preventDefault();
                    }
                });

            }

            if (supports.CARD_SCROLL 
                    && supports.SAFARI_OVERFLOWSCROLL) {

                doc.bind('scrollstart', function(){
                    ck.scrollMask.show();
                }).bind('scrollend', function(){
                    ck.scrollMask.hide();
                });

                doc.bind('touchstart', prevent_window_scroll);

            }

            if (supports.CARD_SCROLL) {

                doc.bind('scroll', function(){
                    if (modalCard.isOpened) {
                        var y = window.scrollY;
                        if (!y && window.innerHeight >= ck.windowFullHeight) {
                            return;
                        }
                        //ck.hideAddressbar();
                        ck.resetWindowTop();
                        body.scrollTop = 0;
                        if (y > 40) {
                            ck.viewport[0].scrollTop = ck.viewport[0].scrollTop + y - 40;
                        }
                    }
                });

            }

            if (supports.CARD_SCROLL
                    && !supports.FULLSCREEN_MODE) {

                var startY,
                    topbar_holded,
                    cancel_hold = function(){
                        topbar_holded = false;
                    },
                    scroll_on_header = function(e){
                        if (this !== e.target) {
                            return;
                        }
                        startY = e.touches[0].clientY;
                        setTimeout(function(){
                            topbar_holded = true;
                            ck.viewport[0].scrollTop = 0;
                        }, 0);
                    };

                this.header.find('.ck-top-title')
                    .bind('touchstart', scroll_on_header);
                this.header.bind('touchstart', scroll_on_header);

                if (supports.FOLDABLE_URLBAR) {

                    this.header.bind('touchmove', function(e){
                        if (topbar_holded && e.touches[0].clientY < startY) {
                            cancel_hold();
                            topbar_holded = true;
                            ck.windowFullHeight = Infinity;
                            ck.hideAddressbar();
                        }
                    }).bind('touchend', cancel_hold)
                        .bind('touchcancel', cancel_hold);

                }

            }

            if (supports.FULLSCREEN_MODE) {
                $(document).on('scrollstart', function(){
                    ck.hideAllBars();
                }).on('scrollend', function(){
                    ck.showAllBars();
                });
            }

        },

        showView: function(){
            $(body).addClass('ck-inited');
            ck.hideAddressbar();
            ck.hideLoadingCard();
            ck.enableControl();
            bus.resolve('inited');
        },

        initWindow: function(){
            this.landscapeMode = this.isLandscape();
            this.windowFullHeight = Infinity;
        },

        initStateWatcher: function(){

            var is_hash_change,
                rewrite_state;

            $(window).bind("hashchange", function(e){
                //alert(location.href + ', \n' 
                 //+ e.newURL + ', \n' + e.oldURL + '\n' 
                 //+ ck._backFromSameUrl + '\n' + ck._preventNextHashEv)
                if (ck._backFromSameUrl) {
                    return;
                }
                is_hash_change = true;
                if (ck._preventNextHashEv 
                        || e.newURL.length >= e.oldURL.length) {
                    ck._preventNextHashEv = false;
                    return;
                }
                if (ck._sessionLocked) {
                    window.location.reload(true);
                    return;
                }
                if (rewrite_state) {
                    //alert(3 + ', ' + rewrite_state)
                    ck.resetWindowTop();
                    push_history(rewrite_state);
                    if (modalCard.isOpened) {
                        modalCard.close();
                    } else if (ck._backFromOtherpage) {
                        //alert(3.1)
                        ck._backFromOtherpage = false;
                        ck.changeView(rewrite_state);
                        ck._sessionLocked = false;
                        ck.showView();
                    } else {
                        //alert(3.2)
                        back_handler(rewrite_state);
                    }
                    rewrite_state = false;
                    return;
                }
                var state = location.hash.split(HASH_SEP).pop();
                if (state && state !== 'i') {
                    //alert(3 + ': ' + state)
                    ck._sessionLocked = false;
                    rewrite_state = state === MODAL_CARDID && DEFAULT_CARDID 
                        || state;
                    if (!$('#' + rewrite_state).hasClass('ck-card')) {
                        //window.location.reload(true);
                        return;
                    }
                    history.back();
                } else {
                    //alert(4)
                    back_handler(LOADING_CARDID);
                }
            });

            bus.once('inited', function(){
                $(window).bind("popstate", when_pop);
            });

            function when_pop(){
                if (ck._backFromSameUrl) {
                    var state = window.location.hash.split(HASH_SEP).pop();
                    //alert('10.2: ' + state)
                    if (!state) {
                        window.location.reload();
                        return;
                    }
                    history.back();
                    return;
                }
                is_hash_change = false;
                setTimeout(function(){
                    //alert(10.1 + ': ' + location.href + ', ' + is_hash_change + ', ' + ck._backFromSameUrl)
                    if (!is_hash_change && !ck._backFromOtherpage) {
                        //alert(10 +': ' + location.href + ', ' + ck._backFromSameUrl)
                        ck._sessionLocked = false;
                        ck._backFromOtherpage = true;
                        if (supports.GOBACK_WHEN_POP
                                && !ck._unexpectStateWhenGoback) {
                            history.back();
                        } else {
                            window.location.reload(true);
                        }
                    }
                }, 100);
            }

        },

        initState: function(){

            ck._sessionLocked = false;

            if (supports.BROWSER_CONTROL) {
                ck.initStateWatcher();
            } else {
                bus.once('inited', function(){
                    var BACK_EVENT = !supports.NO_POP_ON_CACHED_PAGE ? "popstate" : "resize";
                    $(window).bind(BACK_EVENT, function(){
                        if (supports.RESIZE_WHEN_SCROLL
                                && !ck._pageCached) {
                            return;
                        }
                        ck._pageCached = false;
                        ck.hideTopbar();
                        ck.viewport.hide();
                        ck.changeView(ck.loadingCard);
                        setTimeout(function(){
                            window.location.reload();
                        }, 20);
                    });
                });
            }

            var last_state,
                last_is_modal,
                card_states = location.hash.replace(/^#/, '');
            if (card_states) {
                card_states = card_states.split(HASH_SEP);
            }
            if (card_states) {
                var valid_states = [];
                card_states = card_states.map(function(next_id){
                    if (next_id === MODAL_CARDID
                            || next_id === 'i'
                            || next_id && $('#' + next_id).hasClass('ck-card')) {
                        valid_states.push(HASH_SEP + next_id);
                        return next_id;
                    }
                }).filter(function(next_id){
                    return next_id;
                });
                last_state = card_states.pop();
                valid_states = valid_states.join('');
                if ('#' + valid_states !== location.hash) {
                    replace_hash(CLEARED_HASH + valid_states);
                    if (!supports.REPLACE_HASH) {
                        return window.location.reload();
                    }
                }
                if (!supports.BROWSER_CONTROL) {
                    if (last_state === LOADING_CARDID
                            || last_state === MODAL_CARDID) {
                        last_state = null;
                    }
                }
                if (last_state === MODAL_CARDID) {
                    last_is_modal = true;
                    last_state = DEFAULT_CARDID;
                } else if (last_state === 'i') {
                    last_state = null;
                }
            }
            //alert(0 + ': ' + document.referrer + ' , ' + location.href + ', ' + compare_link(document.referrer))
            if (supports.BROWSER_CONTROL
                    && supports.REPLACE_HASH
                    && !compare_link(document.referrer)) {
                replace_hash(CLEARED_HASH);
                if (last_state) {
                    card_states.forEach(function(next_id){
                        if (next_id !== 'i') {
                            push_history(next_id);
                        }
                    });
                    push_history(last_state);
                }
            }

            if (last_state) {
                //alert(2);
                ck.changeView(last_state);
                if (last_state === LOADING_CARDID || last_is_modal) {
                    //alert(2.1 + ': ' + document.referrer)
                    ck._backFromOtherpage = true;
                    history.back();
                } else {
                    ck.showView();
                }
            } else {
                //alert(1)
                ck.initNewPage();
            }
        
        },

        initNewPage: function(){
            ck.changeView(ck.defaultCard);
            push_history(DEFAULT_CARDID);
            ck.showView();
        },

        initView: function(card, opt){
            render.openCard(card, opt);
            if (!card.data('rendered') && !opt.preventRender) {
                render.initCard(card, this.raw, this.footer, opt);
                if (!opt.isModal && !opt.isActions) {
                    card.data('rendered', '1');
                }
            }
            this.watchScroll(card);
            //clear_active_item_mask(card);
        },

        releaseView: function(opt){
            //control.gc(check_gc);
            //picker.gc(check_gc);
            //this.viewportGarbage = {};
            //gc_id = 0;
            if (this.viewport) {
                render.closeCard(this.viewport, opt);
            }
        },

        changeView: function(card, opt){
            opt = opt || {};
            if (!supports.CARD_SCROLL && !opt.preventScroll) {
                ck.resetWindowTop();
            }
            this.releaseView(opt);
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            var is_loading = card === this.loadingCard;
            if (this.viewport && !opt.isNotPrev) {
                card.data('prevCard', this.viewport[0].id);
            }
            this.initView(card, opt);
            this.viewport = card.show();
            this.updateSize(opt);
            if (!opt.isModal && !opt.isActions) {
                this.updateFrame();
            }
            if (!is_loading) {
                setTimeout(function(){
                    bus.fire('readycardchange', [card]);
                }, 0);
            }
        },

        updateSize: function(opt){
            opt = opt || {};

            if ((supports.CARD_SCROLL || opt.isActions)
                    && this.viewport[0].id !== LOADING_CARDID) {

                this.viewport[0].style.height = (this.sizeInited ? 
                    window.innerHeight : (screen.availHeight + 60)) + 2 + 'px';

                // enable scrollable when height is not enough 
                var ft = this.viewport.find('.ck-footer'),
                    last_unit = find_last_unit(ft);
                if (last_unit) {
                    var d = screen.availHeight - (last_unit.offsetTop + last_unit.offsetHeight + this.viewport[0].scrollTop);
                    if (d > 0) {
                        ft.css('paddingTop', d + 'px');
                    } else {
                        ft.css('paddingTop', '0px');
                    }
                }
            }

            this.viewport.find('.ck-mini-unit').forEach(function(mini){
                var mini_items = this('.ck-item', mini),
                    w = ck.slideItemWidth = window.innerWidth - MINI_ITEM_MARGIN - MINI_LIST_PADDING;
                if (mini_items.length > 1) {
                    mini_items.css('width', w - MINI_ITEM_MARGIN - 2 + 'px');
                    this('.ck-list', mini).css('width', w * mini_items.length + MINI_ITEM_MARGIN + 'px');
                }
            }, $);

            bus.fire('cardkit:updateSize');
        },

        watchScroll: function(card){
            this.scrollGesture.watchScroll(card[0]);
        },

        updateFrame: function(){
            render.setFrame(this.viewport, this.header, 
                this.navDrawer, this.raw);
        },

        renderUnit: function(node){
            render.initUnit(node, this.raw);
        },

        hideLoadingCard: function() {
            ck.loadingCard.hide().css({
                height: window.innerHeight + 60 + 'px',
                position: 'static'
            });
            ck.showTopbar();
        },

        hideAllBars: function(){
            $(body).addClass('allbars-disabled');
        },

        showAllBars: function(){
            $(body).removeClass('allbars-disabled');
        },

        hideTopbar: function(){
            if (this.topbarEnable && !this.disableView) {
                this.topbarEnable = false;
                $(body).removeClass('ck-topbar-enabled');
            }
        },

        showTopbar: function(){
            if (!this.topbarEnable) {
                this.topbarEnable = true;
                $(body).addClass('ck-topbar-enabled');
            }
        },

        hideAddressbar: function(){
            if (this.windowFullHeight > window.innerHeight) {
                this.loadingCard.find('div')[0].style.visibility = 'hidden';
                if (supports.FOLDABLE_URLBAR
                        && (supports.CARD_SCROLL || !this.sizeInited)) {
                    ck.resetWindowTop();
                    body.scrollTop = 0;
                    //if (screen.availHeight - ck.viewport[0].offsetHeight 
                            //> ck.headerHeight + 10) {
                        //location.reload();
                        //return;
                    //}
                }
                if (!this.sizeInited) {
                    this.sizeInited = true;
                }
                this.windowFullHeight = window.innerHeight;
                ck.updateSize();
                this.loadingCard.find('div')[0].style.visibility = '';
            }
        },

        resetWindowTop: function(){
            if (supports.HIDE_ADDRESSBAR) {
                window.scrollTo(0, -1);
            }
        },

        isLandscape: function() {
            return window.innerWidth / window.innerHeight > 1.1;
        },

        enableControl: function(){
            this.controlMask.hide();
            window.ckControl = enable_control;
        },

        disableControl: function(){
            this.controlMask.show();
            window.ckControl = disable_control;
        },

        showLoading: function(text){
            this.disableControl();
            if (!this.loadingTips) {
                this.loadingTips = growl({
                    expires: -1,
                    keepalive: true,
                    corner: 'center'
                });
            }
            this.loadingTips.set({
                content: text || '正在加载...'
            }).open();
            this._loadingStart = +new Date();
        },

        hideLoading: function(opt){
            opt = _.mix({ duration: 800 }, opt);
            var d = +new Date() - this._loadingStart;
            if (d < opt.duration) {
                setTimeout(function(){
                    ck.hideLoading(opt);
                }, opt.duration - d);
            } else {
                if (this.loadingTips) {
                    this.loadingTips.close();
                }
                this.enableControl();
            }
        },

        openNavDrawer: function(){
            if (ck._navDrawerLastView) {
                return;
            }
            ck._navDrawerLastView = ck.viewport;
            ck.navDrawer.show();
            ck.changeView(ck.navDrawer.find('article'), {
                preventRender: true,
                isNotPrev: true,
                isModal: true
            });
            $(body).addClass('nav-view');
            //choreo().play().actor(ck.mainview[0], {
                //'transform': 'translateX(' + (screen.availWidth - 40) + 'px)'
            //}, 400).follow().then(function(){
            //});
        },

        closeNavDrawer: function(){
            if (!ck._navDrawerLastView) {
                return;
            }
            ck.changeView(ck._navDrawerLastView, {
                isNotPrev: true
            });
            $(body).removeClass('nav-view');
            setTimeout(function(){
                ck._navDrawerLastView = false;
                ck.navDrawer.hide();
                setTimeout(function(){
                    bus.fire('navdrawer:close');
                }, 50);
            }, 400);
            //choreo().play().actor(ck.mainview[0], {
                //'transform': 'translateX(0px)'
            //}, 400).follow().then(function(){

            //});
            return bus.promise('navdrawer:close');
        },

        openImage: function(src){
            forward_handler(LOADING_CARDID, src);
        },

        openModal: function(opt){
            this.hideAddressbar();
            this.disableControl();
            if (!modalCard.isOpened) {
                push_history(MODAL_CARDID);
            }
            modalCard.set(opt).open();
        },

        closeModal: function(){
            modalCard.cancel();
            return modalCard.event.promise('close');
        },

        alert: function(text, opt) {
            actionView('ckAlert', _.mix({
                title: '提示',
                content: text || '',
                cancelText: '关闭',
                multiselect: false
            }, opt)).open();
        },

        confirm: function(text, cb, opt) {
            actionView('ckAlert', _.mix({
                title: '提示',
                content: text || '',
                confirmText: '确认',
                cancelText: '取消',
                multiselect: true
            }, opt)).open();
            bus.bind('actionView:confirmOnThis', cb);
        },

        notify: function(content, opt) {
            ck.growl(_.mix({
                content: content
            }, opt)).open();
        },

        openURL: open_url,

        delegate: soviet(document, {
            aliasEvents: soviet_aliases,
            autoOverride: true,
            matchesSelector: true,
            preventDefault: true
        }),

        event: bus,

        control: control,
        picker: picker,
        ranger: ranger,
        modalCard: modalCard,
        actionView: actionView, 
        growl: growl

    };

    function nothing(){}

    function stick_item(is_forward){
        var self = $(this).closest('.ck-list-wrap'),
            aid = self.data('ckSlideAnime');
        if (!aid) {
            aid = self.data('ckSlideAnime', +new Date());
        }
        var w = ck.slideItemWidth,
            x = self[0].scrollLeft,
            n = x / w,
            pos = n - Math.floor(n),
            list = $('.ck-list', self)[0],
            l = $('.ck-item', list).length - 1;
        if (n > 0 && (n < l && l - n > 0.1)) {
            if (is_forward) {
                if (pos < 0.1) {
                    n = Math.floor(n);
                } else {
                    n = Math.ceil(n);
                }
            } else {
                if (pos > 0.9) {
                    n = Math.ceil(n);
                } else {
                    n = Math.floor(n);
                }
            }
            var d = x - n * w 
                + (n === l ? MINI_LIST_PADDING : 0);
            self.addClass('stop-scroll');
            choreo(aid).clear().play().actor(list, {
                transform: 'translateX(' + d + 'px)'
            }, 200, 'easeOutSine').follow().then(function(){
                choreo.transform(list, 'translateX', '0');
                self[0].scrollLeft -= d;
                self.removeClass('stop-scroll');
            });
        }
    }

    //function clear_active_item_mask(card){
        //card.find('.ck-link-mask-active').removeClass('ck-link-mask-active');
    //}
    
    function compare_link(href){
        return href.replace(/#.*/, '') === location.href.replace(/#.*/, '');
    }
    
    function check_inner_link(href){
        var next_id,
            current_id,
            next = href.replace(/#(.*)/, function($0, $1){
                next_id = $1;
                return '';
            }),
            current = location.href.replace(/#(.*)/, function($0, $1){
                current_id = $1 || '';
                return '';
            });
        if (next_id && next === current) {
            if (!next_id 
                    || !$('#' + next_id).hasClass('ck-card')
                    || next_id === ck.viewport[0].id) {
                next_id = DEFAULT_CARDID;
                if (current_id.split(HASH_SEP).pop() === next_id) {
                    return false;
                }
            }
        } else {
            next_id = '';
        }
        return next_id;
    }

    function link_handler(e){
        var me = e.target;
        while (!me.href) {
            me = me.parentNode;
        }
        var next_id = check_inner_link(me.href);
        if (next_id === false) {
            return;
        }
        if ($(me).hasClass('ck-link-extern')) {
            open_url(me.href, {
                target: '_blank'
            });
            return;
        } else if ($(me).hasClass('ck-link-direct')) {
            if (next_id) {
                forward_handler(next_id, null, true);
            } else {
                open_url(me.href);
            }
            return;
        } else if ($(me).hasClass('ck-link')
                || $(me).hasClass('ck-link-img')) {
        } else if (/(^|\s)ck-\w+/.test(me.className)) {
            return;
        } else if (me.target) {
            if (next_id && me.target === '_self') {
                forward_handler(next_id, null, true);
            } else {
                open_url(me.href, me);
            }
            return;
        }
        if (next_id) {
            forward_handler(next_id);
        } else {
            forward_handler(LOADING_CARDID, me.href);
        }
    }

    function forward_handler(next_id, true_link, is_load){
        ck.disableControl();
        if (modalCard.isOpened) {
            ck.closeModal().done(function(){
                forward_handler(next_id, true_link);
            });
            return;
        }
        if (ck._navDrawerLastView) {
            ck.closeNavDrawer().then(function(){
                forward_handler(next_id, true_link);
            });
            return;
        }
        ck._sessionLocked = true;
        var next = next_id && $('#' + next_id);
        if (!next.hasClass('ck-card')
                || next_id === ck.viewport[0].id) {
            ck.enableControl();
            ck._sessionLocked = false;
            return;
        }
        ck.hideTopbar();
        var current = ck.viewport;
        push_history(next_id);
        if (is_load) {
            ck.loadingCard.addClass('moving').show();
            setTimeout(function(){
                ck.changeView(next);
                current.hide();
                ck.loadingCard.hide().removeClass('moving');
                ck.enableControl();
                ck._sessionLocked = false;
                ck.showTopbar();
            }, 400);
            return;
        }
        choreo.transform(next[0], 'translateX', window.innerWidth + 'px');
        next.addClass('moving');
        ck.changeView(next);
        ck.cardMask.css('opacity', 0).addClass('moving');
        var moving = choreo('card:moving').clear().play();
        moving.actor(ck.cardMask[0], {
            'opacity': '0.8'
        }, 400, 'ease');
        moving.actor(next[0], {
            'transform': 'translateX(0)'
        }, 450, 'ease');
        moving.follow().then(function(){
            current.hide();
            ck.cardMask.removeClass('moving').css('opacity', 0);
            next.removeClass('moving');
            if (true_link) {
                ck._unexpectStateWhenGoback = false;
                ck._pageCached = true;
                window.location = true_link;
            } else {
                ck.enableControl();
                ck._sessionLocked = false;
                ck.showTopbar();
            }
        });
    }

    function back_handler(prev_id){
        ck._sessionLocked = true;
        ck.disableControl();
        if (ck._navDrawerLastView) {
            ck.closeNavDrawer().then(function(){
                back_handler(prev_id);
            });
            return;
        }
        if (actionView.current) {
            actionView.current.close().event.once('close', function(){
                back_handler(prev_id);
            });
            return;
        }
        ck.hideTopbar();
        var prev = $('#' + prev_id);
        var current = ck.viewport;
        choreo.transform(current[0], 'translateX', '0px');
        current.addClass('moving');
        ck.changeView(prev, {
            isNotPrev: true
        });
        ck.cardMask.css('opacity', '0.8').addClass('moving');
        var moving = choreo('card:moving').clear().play();
        moving.actor(ck.cardMask[0], {
            'opacity': '0'
        }, 400, 'ease');
        moving.actor(current[0], {
            'transform': 'translateX(' + window.innerWidth + 'px)'
        }, 450, 'ease');
        moving.follow().then(function(){
            ck.cardMask.removeClass('moving');
            current.hide().removeClass('moving');
            choreo.transform(current[0], 'translateX', '0px');
            when_back_end(prev_id);
        });
    }

    function when_back_end(prev_id){
        if (prev_id === LOADING_CARDID) {
            //alert('back: ' + document.referrer + '\n' + location.href)
            if (document.referrer
                   && compare_link(document.referrer)
                   || !/#.+/.test(document.referrer)) { // redirect.html
                ck._backFromSameUrl = true;
            }
            history.back();
            var loc = location.href;
            setTimeout(function(){
                if (location.href === loc) {
                    location.reload();
                }
            }, 700);
        } else {
            ck.enableControl();
            ck._sessionLocked = false;
            ck.showTopbar();
        }
    }

    function push_history(next_id){
        if (supports.BROWSER_CONTROL) {
            window.location = location.href.replace(/#(.*)|$/, '#$1' + HASH_SEP + next_id);
        }
    }

    function replace_hash(hash){
        ck._preventNextHashEv = true;
        location.replace(location.href.replace(/#.*/, '') + (hash || CLEARED_HASH));
    }

    function prevent_window_scroll(){
        if (supports.WINDOW_SCROLL) {
            return;
        }
        var vp = ck.viewport[0],
            bottom;
        if (vp.scrollTop < 1) {
            vp.scrollTop = 1;
        } else if (vp.scrollTop > (bottom = vp.scrollHeight 
                - vp.offsetHeight - 1)) {
            vp.scrollTop = bottom;
        }
    }

    //function delay_hide_topbar(){
        //if (ck.viewport[0].scrollTop >= ck.headerHeight) {
            //ck.hideTopbar();
            //$(document).unbind('touchmove', delay_hide_topbar)
                //.unbind('touchend', delay_hide_topbar);
        //}
    //}

    function open_url(true_link, opt){
        opt = opt || { target: '_self' };
        if (opt.target !== '_self') {
            open_window(true_link, opt.target);
        } else {
            ck.disableControl();
            if (modalCard.isOpened) {
                ck.closeModal().done(function(){
                    open_url(true_link, opt);
                });
                return;
            }
            if (ck._navDrawerLastView) {
                ck.closeNavDrawer().then(function(){
                    open_url(true_link, opt);
                });
                return;
            }
            ck._sessionLocked = true;
            ck.hideTopbar();
            var next = ck.loadingCard;
            var current = ck.viewport;
            push_history(LOADING_CARDID);
            next.addClass('moving');
            ck.changeView(next);
            setTimeout(function(){
                current.hide();
                next.removeClass('moving');
                ck._unexpectStateWhenGoback = false;
                ck._pageCached = true;
                window.location = true_link;
            }, 10);
        }
    }

    function open_window(url, target){
        if (supports.NEW_WIN) {
            window.open(url, target);
        } else {
            $('<a href="' + url + '" target="' + target + '"></a>').trigger('click');
        }
    }

    function find_last_unit(ft){
        var last_unit = ft && ft.prev()[0];
        if (last_unit && !last_unit.offsetHeight) {
            return find_last_unit($(last_unit));
        }
        return last_unit;
    }

    function set_alias_events(events) {
        for (var ev in events) {
            $.Event.aliases[ev] = soviet_aliases[ev] = 'ck_' + events[ev];
        }
    }

    //function init_card_drag(){
        //var _startX, _current, _prev, _clone, _hideTimer;
        //ck.mainview.on('dragstart', function(e){
            //_startX = e.clientX;
            //_current = ck.viewport.addClass('moving');
            //_clone = _current.clone().show().prependTo(ck.wrapper);
            //_prev = $('#' + (_current.data('prevCard') || LOADING_CARDID));
            //ck.hideTopbar();
            //ck.changeView(_prev, {
                //isNotPrev: true
            //});
            //ck.cardMask.css('opacity', '0.8').addClass('moving');
            //_hideTimer = setTimeout(function(){
                //_current.addClass('hidding');
            //}, 200);
        //}).on('drag', function(e){
            //var d = e.clientX - _startX;
            //if (d < 0) {
                //d = 0;
            //}
            //choreo.transform(_clone[0], 'translateX', d + 'px');
            //ck.cardMask.css('opacity', (1 - d / window.innerWidth) * 0.8);
        //}).on('dragend', function(e){
            //clearTimeout(_hideTimer);
            //var d = e.clientX - _startX;
            //if (d < 0) {
                //d = 0;
            //}
            //var s = d / window.innerWidth;
            //if (s > 0.3) {
                //choreo().play().actor(_clone[0], {
                    //'transform': 'translateX(' + window.innerWidth + 'px)'
                //}, 100).follow().then(function(){
                    //ck._preventNextHashEv = true;
                    //history.back();
                    //ck.cardMask.removeClass('moving').css('opacity', 0);
                    //_clone.hide().removeClass('moving');
                    //_current.remove();
                    //when_back_end(_prev[0].id);
                //});
            //} else {
                //choreo().play().actor(_clone[0], {
                    //'transform': 'translateX(0px)'
                //}, 100).follow().then(function(){
                    //ck.changeView(_clone);
                    //ck.cardMask.removeClass('moving').css('opacity', 0);
                    //_prev.hide();
                    //_clone.removeClass('moving');
                    //_current.remove();
                    //ck.showTopbar();
                //});
            //}
        //});
    //}

    //function check_gc(controller){
        //return ck.viewportGarbage[controller.parentId];
    //}

    function enable_control(){}

    function disable_control(){ return false; }

    return ck;

});

/* @source  */;


require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

//define('mo/lang/es5', [], function(){});
define('mo/easing/functions', [], function(){});
define('mo/mainloop', [], function(){});

define('cardkit/env', ['mo/browsers'], function(){
    return {};
});

define('cardkit/pageready', [
    'finish', 
    'cardkit/bus'
], function(finish, bus){
    bus.once('readycardchange', function(){
        setTimeout(finish, 500);
    });
});

require([
    'dollar', 
    'cardkit/bus',
    'cardkit/app',
    'cardkit/env'
], function($, bus, app, env){

    if (env.enableConsole) {
        require([
            'mo/console'
        ], function(console){

            console.config({
                record: true
            }).enable();

            init();

        });
    } else {
        init();
    }

    function init(){
        app.init({
            root: $('.ck-root')
        });
    }

});
