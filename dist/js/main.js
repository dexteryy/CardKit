
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
                block = autofile(unifyname(name));
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
            return (_config.mods[unifyname(deps, _scope)] 
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
                        || _config.mods[mid] 
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
        var true_url = /^\w+:\/\//.test(url) ? url 
            : (_config.enable_ozma && _config.distUrl || _config.baseUrl || '') 
                + (_config.enableAutoSuffix ? truefile(url) : url);
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
            var true_mid = unifyname(mid, file_mod);
            if (mid !== true_mid) {
                _config.mods[file_mod.url + ':' + mid] = true_mid;
                mid = true_mid;
            }
            if (!_config.mods[true_mid]) {
                define(true_mid, autofile(true_mid));
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
        var true_mid = this[m.url + ':' + dep];
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
function truefile(file){
    return file.replace(/(.+?)(_src.*)?(\.\w+)$/, function($0, $1, $2, $3){
        return $1 + ($2 && '_combo' || '_pack') + $3;
    });
}

function autofile(mid){
    var alias = _config.aliases;
    if (alias) {
        mid = mid.replace(_RE_ALIAS_IN_MID, function(e1, e2){
            return alias[e2] || (e2 + '/');
        });
    }
    return _RE_SUFFIX.test(mid) ? mid : mid + '.js';
}

function unifyname(mid, file_mod){
    var rel_path = _RE_RELPATH.exec(mid);
    if (rel_path) { // resolve relative path in Module ID
        if (file_mod) {
            mid = (file_mod.url || '').replace(/[^\/]+$/, '') + rel_path[0];
        }
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
    VERSION: '2.5.0',
    define: define,
    require: require,
    config: config,
    seek: seek,
    fetch: fetch,
    unifyname: unifyname,
    autofile: autofile,
    truefile: truefile,
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

/* @source iscroll-lite.js */;

/*!
 * iScroll Lite base on iScroll v4.1.6 ~ Copyright (c) 2011 Matteo Spinelli, http://cubiq.org
 * Released under MIT license, http://cubiq.org/license
 */

(function(){
var m = Math,
	mround = function (r) { return r >> 0; },
	vendor = (/webkit/i).test(navigator.appVersion) ? 'webkit' :
		(/firefox/i).test(navigator.userAgent) ? 'Moz' :
		'opera' in window ? 'O' : '',

    // Browser capabilities
    isAndroid = (/android/gi).test(navigator.appVersion),
    isIDevice = (/iphone|ipad/gi).test(navigator.appVersion),
    isPlaybook = (/playbook/gi).test(navigator.appVersion),
    isTouchPad = (/hp-tablet/gi).test(navigator.appVersion),

    has3d = 'WebKitCSSMatrix' in window && 'm11' in new WebKitCSSMatrix(),
    hasTouch = 'ontouchstart' in window && !isTouchPad,
    hasTransform = vendor + 'Transform' in document.documentElement.style,
    hasTransitionEnd = isIDevice || isPlaybook,

	nextFrame = (function() {
	    return window.requestAnimationFrame
			|| window.webkitRequestAnimationFrame
			|| window.mozRequestAnimationFrame
			|| window.oRequestAnimationFrame
			|| window.msRequestAnimationFrame
			|| function(callback) { return setTimeout(callback, 17); }
	})(),
	cancelFrame = (function () {
	    return window.cancelRequestAnimationFrame
			|| window.webkitCancelAnimationFrame
			|| window.webkitCancelRequestAnimationFrame
			|| window.mozCancelRequestAnimationFrame
			|| window.oCancelRequestAnimationFrame
			|| window.msCancelRequestAnimationFrame
			|| clearTimeout
	})(),

	// Events
	RESIZE_EV = 'onorientationchange' in window ? 'orientationchange' : 'resize',
	START_EV = hasTouch ? 'touchstart' : 'mousedown',
	MOVE_EV = hasTouch ? 'touchmove' : 'mousemove',
	END_EV = hasTouch ? 'touchend' : 'mouseup',
	CANCEL_EV = hasTouch ? 'touchcancel' : 'mouseup',

	// Helpers
	trnOpen = 'translate' + (has3d ? '3d(' : '('),
	trnClose = has3d ? ',0)' : ')',

	// Constructor
	iScroll = function (el, options) {
		var that = this,
			doc = document,
			i;

		that.wrapper = typeof el == 'object' ? el : doc.getElementById(el);
		that.wrapper.style.overflow = 'hidden';
		that.scroller = that.wrapper.children[0];

		// Default options
		that.options = {
			hScroll: true,
			vScroll: true,
			x: 0,
			y: 0,
			bounce: true,
			bounceLock: false,
			momentum: true,
			lockDirection: true,
			useTransform: true,
			useTransition: false,

			// Events
			onRefresh: null,
			onBeforeScrollStart: function (e) { e.preventDefault(); },
			onScrollStart: null,
			onBeforeScrollMove: null,
			onScrollMove: null,
			onBeforeScrollEnd: null,
			onScrollEnd: null,
			onTouchEnd: null,
			onDestroy: null
		};

		// User defined options
		for (i in options) that.options[i] = options[i];

		// Set starting position
		that.x = that.options.x;
		that.y = that.options.y;

		// Normalize options
		that.options.useTransform = hasTransform ? that.options.useTransform : false;
		that.options.hScrollbar = that.options.hScroll && that.options.hScrollbar;
		that.options.vScrollbar = that.options.vScroll && that.options.vScrollbar;
		that.options.useTransition = hasTransitionEnd && that.options.useTransition;

		// Set some default styles
		that.scroller.style[vendor + 'TransitionProperty'] = that.options.useTransform ? '-' + vendor.toLowerCase() + '-transform' : 'top left';
		that.scroller.style[vendor + 'TransitionDuration'] = '0';
		that.scroller.style[vendor + 'TransformOrigin'] = '0 0';
		if (that.options.useTransition) that.scroller.style[vendor + 'TransitionTimingFunction'] = 'cubic-bezier(0.33,0.66,0.66,1)';
		
		if (that.options.useTransform) that.scroller.style[vendor + 'Transform'] = trnOpen + that.x + 'px,' + that.y + 'px' + trnClose;
		else that.scroller.style.cssText += ';position:absolute;top:' + that.y + 'px;left:' + that.x + 'px';

		that.refresh();

		that._bind(RESIZE_EV, window);
		that._bind(START_EV);
		if (!hasTouch) that._bind('mouseout', that.wrapper);
	};

// Prototype
iScroll.prototype = {
	enabled: true,
	x: 0,
	y: 0,
	steps: [],
	scale: 1,
	
	handleEvent: function (e) {
		var that = this;
		switch(e.type) {
			case START_EV:
				if (!hasTouch && e.button !== 0) return;
				that._start(e);
				break;
			case MOVE_EV: that._move(e); break;
			case END_EV:
			case CANCEL_EV: that._end(e); break;
			case RESIZE_EV: that._resize(); break;
			case 'mouseout': that._mouseout(e); break;
			case 'webkitTransitionEnd': that._transitionEnd(e); break;
		}
	},

	_resize: function () {
		this.refresh();
	},
	
	_pos: function (x, y) {
		x = this.hScroll ? x : 0;
		y = this.vScroll ? y : 0;

		if (this.options.useTransform) {
			this.scroller.style[vendor + 'Transform'] = trnOpen + x + 'px,' + y + 'px' + trnClose + ' scale(' + this.scale + ')';
		} else {
			x = mround(x);
			y = mround(y);
			this.scroller.style.left = x + 'px';
			this.scroller.style.top = y + 'px';
		}

		this.x = x;
		this.y = y;
	},

	_start: function (e) {
		var that = this,
			point = hasTouch ? e.touches[0] : e,
			matrix, x, y;

		if (!that.enabled) return;

		if (that.options.onBeforeScrollStart) that.options.onBeforeScrollStart.call(that, e);
		
		if (that.options.useTransition) that._transitionTime(0);

		that.moved = false;
		that.animating = false;
		that.zoomed = false;
		that.distX = 0;
		that.distY = 0;
		that.absDistX = 0;
		that.absDistY = 0;
		that.dirX = 0;
		that.dirY = 0;

		if (that.options.momentum) {
			if (that.options.useTransform) {
				// Very lame general purpose alternative to CSSMatrix
				matrix = getComputedStyle(that.scroller, null)[vendor + 'Transform'].replace(/[^0-9-.,]/g, '').split(',');
				x = matrix[4] * 1;
				y = matrix[5] * 1;
			} else {
				x = getComputedStyle(that.scroller, null).left.replace(/[^0-9-]/g, '') * 1;
				y = getComputedStyle(that.scroller, null).top.replace(/[^0-9-]/g, '') * 1;
			}
			
			if (x != that.x || y != that.y) {
				if (that.options.useTransition) that._unbind('webkitTransitionEnd');
				else cancelFrame(that.aniTime);
				that.steps = [];
				that._pos(x, y);
			}
		}

		that.startX = that.x;
		that.startY = that.y;
		that.pointX = point.pageX;
		that.pointY = point.pageY;

		that.startTime = e.timeStamp || Date.now();

		if (that.options.onScrollStart) that.options.onScrollStart.call(that, e);

		that._bind(MOVE_EV);
		that._bind(END_EV);
		that._bind(CANCEL_EV);
	},
	
	_move: function (e) {
		var that = this,
			point = hasTouch ? e.touches[0] : e,
			deltaX = point.pageX - that.pointX,
			deltaY = point.pageY - that.pointY,
			newX = that.x + deltaX,
			newY = that.y + deltaY,
			timestamp = e.timeStamp || Date.now();

		if (that.options.onBeforeScrollMove) that.options.onBeforeScrollMove.call(that, e);

		that.pointX = point.pageX;
		that.pointY = point.pageY;

		// Slow down if outside of the boundaries
		if (newX > 0 || newX < that.maxScrollX) {
			newX = that.options.bounce ? that.x + (deltaX / 2) : newX >= 0 || that.maxScrollX >= 0 ? 0 : that.maxScrollX;
		}
		if (newY > 0 || newY < that.maxScrollY) { 
			newY = that.options.bounce ? that.y + (deltaY / 2) : newY >= 0 || that.maxScrollY >= 0 ? 0 : that.maxScrollY;
		}

		that.distX += deltaX;
		that.distY += deltaY;
		that.absDistX = m.abs(that.distX);
		that.absDistY = m.abs(that.distY);

		if (that.absDistX < 6 && that.absDistY < 6) {
			return;
		}

		// Lock direction
		if (that.options.lockDirection) {
			if (that.absDistX > that.absDistY + 5) {
				newY = that.y;
				deltaY = 0;
			} else if (that.absDistY > that.absDistX + 5) {
				newX = that.x;
				deltaX = 0;
			}
		}

		that.moved = true;
		that._pos(newX, newY);
		that.dirX = deltaX > 0 ? -1 : deltaX < 0 ? 1 : 0;
		that.dirY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

		if (timestamp - that.startTime > 300) {
			that.startTime = timestamp;
			that.startX = that.x;
			that.startY = that.y;
		}
		
		if (that.options.onScrollMove) that.options.onScrollMove.call(that, e);
	},
	
	_end: function (e) {
		if (hasTouch && e.touches.length != 0) return;

		var that = this,
			point = hasTouch ? e.changedTouches[0] : e,
			target, ev,
			momentumX = { dist:0, time:0 },
			momentumY = { dist:0, time:0 },
			duration = (e.timeStamp || Date.now()) - that.startTime,
			newPosX = that.x,
			newPosY = that.y,
			newDuration;

		that._unbind(MOVE_EV);
		that._unbind(END_EV);
		that._unbind(CANCEL_EV);

		if (that.options.onBeforeScrollEnd) that.options.onBeforeScrollEnd.call(that, e);

		if (!that.moved) {
			if (hasTouch) {
				// Find the last touched element
				target = point.target;
				while (target.nodeType != 1) target = target.parentNode;

				if (target.tagName != 'SELECT' && target.tagName != 'INPUT' && target.tagName != 'TEXTAREA') {
					ev = document.createEvent('MouseEvents');
					ev.initMouseEvent('click', true, true, e.view, 1,
						point.screenX, point.screenY, point.clientX, point.clientY,
						e.ctrlKey, e.altKey, e.shiftKey, e.metaKey,
						0, null);
					ev._fake = true;
					target.dispatchEvent(ev);
				}
			}

			that._resetPos(200);

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		if (duration < 300 && that.options.momentum) {
			momentumX = newPosX ? that._momentum(newPosX - that.startX, duration, -that.x, that.scrollerW - that.wrapperW + that.x, that.options.bounce ? that.wrapperW : 0) : momentumX;
			momentumY = newPosY ? that._momentum(newPosY - that.startY, duration, -that.y, (that.maxScrollY < 0 ? that.scrollerH - that.wrapperH + that.y : 0), that.options.bounce ? that.wrapperH : 0) : momentumY;

			newPosX = that.x + momentumX.dist;
			newPosY = that.y + momentumY.dist;

 			if ((that.x > 0 && newPosX > 0) || (that.x < that.maxScrollX && newPosX < that.maxScrollX)) momentumX = { dist:0, time:0 };
 			if ((that.y > 0 && newPosY > 0) || (that.y < that.maxScrollY && newPosY < that.maxScrollY)) momentumY = { dist:0, time:0 };
		}

		if (momentumX.dist || momentumY.dist) {
			newDuration = m.max(m.max(momentumX.time, momentumY.time), 10);

			that.scrollTo(mround(newPosX), mround(newPosY), newDuration);

			if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
			return;
		}

		that._resetPos(200);
		if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
	},
	
	_resetPos: function (time) {
		var that = this,
			resetX = that.x >= 0 ? 0 : that.x < that.maxScrollX ? that.maxScrollX : that.x,
			resetY = that.y >= 0 || that.maxScrollY > 0 ? 0 : that.y < that.maxScrollY ? that.maxScrollY : that.y;

		if (resetX == that.x && resetY == that.y) {
			if (that.moved) {
				if (that.options.onScrollEnd) that.options.onScrollEnd.call(that);		// Execute custom code on scroll end
				that.moved = false;
			}

			return;
		}

		that.scrollTo(resetX, resetY, time || 0);
	},
	
	_mouseout: function (e) {
		var t = e.relatedTarget;

		if (!t) {
			this._end(e);
			return;
		}

		while (t = t.parentNode) if (t == this.wrapper) return;
		
		this._end(e);
	},

	_transitionEnd: function (e) {
		var that = this;

		if (e.target != that.scroller) return;

		that._unbind('webkitTransitionEnd');
		
		that._startAni();
	},

	/**
	 *
	 * Utilities
	 *
	 */
	_startAni: function () {
		var that = this,
			startX = that.x, startY = that.y,
			startTime = Date.now(),
			step, easeOut,
			animate;

		if (that.animating) return;

		if (!that.steps.length) {
			that._resetPos(400);
			return;
		}

		step = that.steps.shift();

		if (step.x == startX && step.y == startY) step.time = 0;

		that.animating = true;
		that.moved = true;

		if (that.options.useTransition) {
			that._transitionTime(step.time);
			that._pos(step.x, step.y);
			that.animating = false;
			if (step.time) that._bind('webkitTransitionEnd');
			else that._resetPos(0);
			return;
		}
		
		animate = function () {
			var now = Date.now(),
				newX, newY;

			if (now >= startTime + step.time) {
				that._pos(step.x, step.y);
				that.animating = false;
				if (that.options.onAnimationEnd) that.options.onAnimationEnd.call(that);			// Execute custom code on animation end
				that._startAni();
				return;
			}

			now = (now - startTime) / step.time - 1;
			easeOut = m.sqrt(1 - now * now);
			newX = (step.x - startX) * easeOut + startX;
			newY = (step.y - startY) * easeOut + startY;
			that._pos(newX, newY);
			if (that.animating) that.aniTime = nextFrame(animate);
		};
		
		animate();
	},

	_transitionTime: function (time) {
		this.scroller.style[vendor + 'TransitionDuration'] = time + 'ms';
	},
	
	_momentum: function (dist, time, maxDistUpper, maxDistLower, size) {
		var deceleration = 0.0006,
			speed = m.abs(dist) / time,
			newDist = (speed * speed) / (2 * deceleration),
			newTime = 0, outsideDist = 0;

		// Proportinally reduce speed if we are outside of the boundaries 
		if (dist > 0 && newDist > maxDistUpper) {
			outsideDist = size / (6 / (newDist / speed * deceleration));
			maxDistUpper = maxDistUpper + outsideDist;
			speed = speed * maxDistUpper / newDist;
			newDist = maxDistUpper;
		} else if (dist < 0 && newDist > maxDistLower) {
			outsideDist = size / (6 / (newDist / speed * deceleration));
			maxDistLower = maxDistLower + outsideDist;
			speed = speed * maxDistLower / newDist;
			newDist = maxDistLower;
		}

		newDist = newDist * (dist < 0 ? -1 : 1);
		newTime = speed / deceleration;

		return { dist: newDist, time: mround(newTime) };
	},

	_offset: function (el) {
		var left = -el.offsetLeft,
			top = -el.offsetTop;
			
		while (el = el.offsetParent) {
			left -= el.offsetLeft;
			top -= el.offsetTop;
		} 

		return { left: left, top: top };
	},

	_bind: function (type, el, bubble) {
		(el || this.scroller).addEventListener(type, this, !!bubble);
	},

	_unbind: function (type, el, bubble) {
		(el || this.scroller).removeEventListener(type, this, !!bubble);
	},


	/**
	 *
	 * Public methods
	 *
	 */
	destroy: function () {
		var that = this;

		that.scroller.style[vendor + 'Transform'] = '';

		// Remove the event listeners
		that._unbind(RESIZE_EV, window);
		that._unbind(START_EV);
		that._unbind(MOVE_EV);
		that._unbind(END_EV);
		that._unbind(CANCEL_EV);
		that._unbind('mouseout', that.wrapper);
		if (that.options.useTransition) that._unbind('webkitTransitionEnd');
		
		if (that.options.onDestroy) that.options.onDestroy.call(that);
	},

	refresh: function () {
		var that = this,
			offset;

		that.wrapperW = that.wrapper.clientWidth;
		that.wrapperH = that.wrapper.clientHeight;

		that.scrollerW = that.scroller.offsetWidth;
		that.scrollerH = that.scroller.offsetHeight;
		that.maxScrollX = that.wrapperW - that.scrollerW;
		that.maxScrollY = that.wrapperH - that.scrollerH;
		that.dirX = 0;
		that.dirY = 0;

		that.hScroll = that.options.hScroll && that.maxScrollX < 0;
		that.vScroll = that.options.vScroll && (!that.options.bounceLock && !that.hScroll || that.scrollerH > that.wrapperH);

		offset = that._offset(that.wrapper);
		that.wrapperOffsetLeft = -offset.left;
		that.wrapperOffsetTop = -offset.top;


		that.scroller.style[vendor + 'TransitionDuration'] = '0';

		that._resetPos(200);
	},

	scrollTo: function (x, y, time, relative) {
		var that = this,
			step = x,
			i, l;

		that.stop();

		if (!step.length) step = [{ x: x, y: y, time: time, relative: relative }];
		
		for (i=0, l=step.length; i<l; i++) {
			if (step[i].relative) { step[i].x = that.x - step[i].x; step[i].y = that.y - step[i].y; }
			that.steps.push({ x: step[i].x, y: step[i].y, time: step[i].time || 0 });
		}

		that._startAni();
	},

	scrollToElement: function (el, time) {
		var that = this, pos;
		el = el.nodeType ? el : that.scroller.querySelector(el);
		if (!el) return;

		pos = that._offset(el);
		pos.left += that.wrapperOffsetLeft;
		pos.top += that.wrapperOffsetTop;

		pos.left = pos.left > 0 ? 0 : pos.left < that.maxScrollX ? that.maxScrollX : pos.left;
		pos.top = pos.top > 0 ? 0 : pos.top < that.maxScrollY ? that.maxScrollY : pos.top;
		time = time === undefined ? m.max(m.abs(pos.left)*2, m.abs(pos.top)*2) : time;

		that.scrollTo(pos.left, pos.top, time);
	},

	disable: function () {
		this.stop();
		this._resetPos(0);
		this.enabled = false;

		// If disabled after touchstart we make sure that there are no left over events
		this._unbind(MOVE_EV);
		this._unbind(END_EV);
		this._unbind(CANCEL_EV);
	},
	
	enable: function () {
		this.enabled = true;
	},
	
	stop: function () {
		cancelFrame(this.aniTime);
		this.steps = [];
		this.moved = false;
		this.animating = false;
	}
};

if (typeof exports !== 'undefined') exports.iScroll = iScroll;
else window.iScroll = iScroll;

})();

/* autogeneration */
define("iscroll-lite.src", [], function(){});

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
define("mo/lang", [], function(require, exports){

    var host = this,
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

	exports.isEmptyObject = function(obj) {
        for (var name in obj) {
            return false;
        }
        return true;
	};
    
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
  "mo/lang"
], function(_){

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
        _array_each = Array.prototype.forEach,
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

    var ext = $.fn = $.prototype = Object.create(Array.prototype);

    ['map', 'filter', 'slice', 'splice', 'concat'].forEach(function(method){
        var origin = this['_' + method] = this[method];
        this[method] = function(){
            return $(origin.apply(this, arguments));
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

        trigger: function(event){
            if (typeof event == 'string') {
                event = Event(event);
            }
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
        var is_fn_arg = _.isFunction(arg);
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
                    var is_fn_arg = _.isFunction(value);
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
        return function(subject, cb){
            var ev = [];
            if (typeof subject !== 'string') {
                for (var i in subject) {
                    ev.push([action, i, subject[i]]);
                }
            } else if (!cb) {
                this.forEach(function(node){
                    node['on' + this] = null;
                }, subject);
                return this;
            } else {
                ev.push([action, subject, cb]);
            }
            this.forEach(function(node){
                this.forEach(function(pair){
                    this[pair[0] + 'EventListener'](pair[1], pair[2], false);
                }, node);
            }, ev);
            return this;
        };
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
        event.initEvent(type, bubbles, true, null, null, null, null, 
            null, null, null, null, null, null, null, null);
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

    $.matchesSelector = matches_selector;
    $.createNodes = create_nodes;
    $.camelize = css_method;
    $.dasherize = css_prop;
    $.Event = Event;

    $.VERSION = '1.0.1';

    return $;

});

/* @source uiproxy.js */;

define('uiproxy', [
  "dollar",
  "mo/lang"
], function($, _) {
    var exports = {
        bind: function(node, events) {},
        unbind: function(node, events) {}
    };

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
  "mo/lang"
], function(_){

    var fnQueue = _.fnQueue,
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
  "mo/lang"
], function(_, require, exports){

    var document = this.document;

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

    // forked from  underscore.js 
    exports.tplSettings = {
        _cache: {},
        evaluate: /\{%([\s\S]+?)%\}/g,
        interpolate: /\{%=([\s\S]+?)%\}/g
    };
    exports.tplHelpers = {
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
  "mo/browsers"
], function(_, browsers, require, exports){

    var ns = _.ns,
        uuid4jsonp = 1;

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

    exports.getScript = oz._getScript;

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
                ajax({
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
        if (op.random)
            data[op.random] = +new Date();
        var cbName = op.callbackName || 'jsoncallback';
        data[cbName] = op.callback;
        url = [url, /\?/.test(url) ? "&" : "?", httpParam(data)].join("");
        if (fn)
            ns(op.callback, fn);
        delete op.callback;
        exports.getScript(url, op);
    };

    exports.getRequest = function(url, params){
        var img = new Image();
        img.onload = function(){ img = null; }; //阻止IE下的自动垃圾回收引起的请求未发出状况
        img.src = !params ? url : [url, /\?/.test(url) ? "&" : "?", typeof params == "string" ? params : httpParam(params)].join('');
    };

});

/* @source modal.js */;

define('modal', [
  "dollar",
  "mo/lang",
  "mo/network",
  "mo/template",
  "eventmaster",
  "uiproxy"
], function($, _, net, tpl, Event, uiproxy) {
    var body = $('body'),
        ID = 'modal-',

        LOADING_DOTS = '<span class="ui-inline-loading"><i>.</i><i>.</i><i>.</i></span>',

        TPL_MODAL =
           '<div id="{{id}}" class="modal-view">\
                <div class="modal-header">\
                    <div class="right-button">\
                    </div>\
                    <div class="left-button">\
                    </div>\
                    <h1 class="modal-title">\
                    </h1>\
                </div>\
                <div class="modal-content"></div>\
            </div>',
        TPL_BTN = '<a class="btn {{type}}">{{text}}</a>';

    var _mid = 0;

    var defaults = {
        title: '',
        buttons: [{
            text: '确定',
            type: 'primary',
            align: 'right',
            method: function(modal) {
                modal.submit(function() {
                    modal.close();
                });
                modal.loading('提交中');
            }
        }, {
            text: '取消',
            align: 'left',
            method: function(modal) {
                modal.close();
            }
        }],
        content: '',
        async: undefined,
        iframeUrl: '',
        event: {}
    };

    function Modal(opt) {
        this.id = ID + (_mid++);
        this.event = Event();
        this.config = _.mix({}, defaults, opt);

        body.append(tpl.format(TPL_MODAL, {id: this.id}));
        this.node = $('#' + this.id);
        this.title = this.node.find('.modal-title');
        this.rightButton = this.node.find('.right-button');
        this.leftButton = this.node.find('.left-button');
        this.content = this.node.find('.modal-content');

        this.set(this.config);
    }

    Modal.prototype = {
        set: function(opt) {
            var self = this;

            this.config = _.mix(this.config, opt);

            // Buttons
            if (opt.buttons && opt.buttons.length > 0) {
                opt.events = opt.events || {};
                opt.buttons.forEach(function(btn) {
                    var btnEvent = 'click .' + btn.align + '-button .btn';
                    self[btn.align + 'Button'].html(function() {
                        var btnType = btn.type !== undefined ?
                                ('btn-' + btn.type) :  '';
                        return tpl.format(TPL_BTN, {
                            type: btnType,
                            text: btn.text
                        });
                    });
                    opt.events[btnEvent] = btn.method;
                });
            }

            // Title
            if (typeof opt.title === 'string') {
                this.title.html(opt.title);
            }

            // Content
            if (opt.async) {
                var asyncOpt = _.mix({
                        success: function(content, modal) {
                            modal.set({'content': content});
                        }
                    }, opt.async);

                asyncOpt.success = function(data) {
                    asyncOpt.success(data, self);
                };
                net.ajax(asyncOpt);
            } else if (opt.iframeUrl) {
                //TODO
            } else if (opt.content) {
                this.content.empty().append($(opt.content));
            }

            // Events
            this.bind(opt.events);

            return this;
        },
        bind: function(events) {
            uiproxy.bind(this.node, events);
        },
        unbind: function(events) {
            uiproxy.unbind(this.node, events);
        },
        loading: function(opt) {
            var text;
            if (typeof opt === 'string') {
                text = opt;
                opt = null;
            } else if (typeof opt == 'object') {
                text = opt.text;
            }
            this.title.html(text + LOADING_DOTS);

            return this;
        },
        open: function() {
            //TODO: fx
            this.node.appendTo(body).show();
            this.event.fire('open', [this]);

            return this;
        },
        close: function() {
            //TODO: fx
            this.node.hide();
            this.event.fire('close', [this]);

            return this;
        },
        destroy: function() {
            this.node.remove();
            this.event.fire('destroy', [this]);

            return this;
        },
        submit: function(opt) {
            var self = this,
                form = this.node.find('form')[0],
                success = _.isFunction(opt) ? opt : opt.success,
                error = _.isFunction(opt) ? undefined : opt.error;

            if (form === undefined) {
                return;
            }
            net.ajax({
                type: form.method,
                data: $(form).serialize(),
                success: success,
                error: error
            });

            return this;
        }
    };

    return function(opt) {
        return new Modal(opt);
    };
});

/* @source ../cardkit/view/modal.js */;

define('cardkit/view/modal', [
  "dollar",
  "modal"
], function($, Modal) {
    var modal = Modal();

    return modal;
});

/* @source ../cardkit/bus.js */;

define("cardkit/bus", [
  "eventmaster"
], function(Event){

    return Event();

});

/* @source ../cardkit/view.js */;

define("cardkit/view", [
  "dollar",
  "mo/lang",
  "mo/template",
  "cardkit/bus",
  "cardkit/view/modal",
  "iscroll-lite",
  "mo/domready"
], function($, _, tpl, bus, modal, iScroll){

    var view = {

        init: function(opt){
            var win = $(window),
                //win_width = win.width(),
                //win_height = win.height(),
                header = $('.ck-header'),
                viewport = this.viewport = $('.ck-viewport');
            this.piles = $('.ck-pile', viewport);
            this.cards = $('.ck-card', viewport);

            if (header.length === 0) {
                return;
            }

            this.render();

            var currentY,
                direction,
                count = 0,
                _abs = Math.abs,
                header_height = header.height();
            document.addEventListener('touchmove', function (e) {
                e.preventDefault(); 
                var y = e.touches[0].pageY;
                direction = y - currentY;
                currentY = y;
                if (direction > 0) {
                    if (direction > 50) {
                        count = 10;
                    } else {
                        if (count < 0) {
                            count = 0;
                        }
                        count++;
                    }
                } else if (direction < 0) {
                    if (direction < -50) {
                        count = 10;
                    } else {
                        if (count > 0) {
                            count = 0;
                        }
                        count--;
                    }
                }
                if (_abs(count) === 10) {
                    if (direction > 0) {
                        header.css('top', 0);
                    } else {
                        header.css('top', 0 - header_height + 'px');
                    }
                }
            }, false);

            this.scroll = new iScroll(viewport[0], {
                hScroll: false,
                hScrollbar: false
            });
        },

        render: function(){
            this.cards.find('.ck-link').forEach(function(item){
                item = $(item);
                var target_id = item.attr('href').replace(/^.*#/, ''),
                    hd = $('#' + target_id).find('.ck-hd').html();
                if (hd) {
                    item.html(hd.trim());
                } else {
                    var card = item.parent().parent();
                    item.parent().remove();
                    if (!/\S/.test(card.html())) {
                        card.remove();
                    }
                }
            });
        }

    };

    view.modal = modal;

    return view;

});

/* @source ../cardkit/app.js */;

define("cardkit/app", [
  "mo/lang",
  "cardkit/bus",
  "cardkit/view"
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
        'cardkit': '../cardkit/'
    }
});

define('iscroll-lite.src', 'iscroll-lite.js');
define('iscroll-lite', ['iscroll-lite.src'], function(){
    return window.iScroll;
});

require([
    'dollar', 
    'cardkit/app'
], function($, app){

    app.setup({
        header: $('.ck-header'),
        viewport: $('.ck-viewport')
    });

});
