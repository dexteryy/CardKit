
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


/* @source ../cardkit/app.js */;

define([
    'dollar',
    'mo/lang',
    'mo/browsers',
    'mo/template',
    'soviet',
    'choreo',
    'momo/base',
    'momo/tap',
    'momo/swipe',
    'momo/drag',
    'momo/scroll',
    './view/control',
    './view/picker',
    './view/stars',
    './view/modalcard',
    './view/actionview',
    './view/growl',
    './view/slidelist',
    './bus',
    './render',
    './supports',
    'mo/domready'
], function($, _, browsers, tpl, soviet, choreo, 
    momoBase, momoTap, momoSwipe, momoDrag, momoScroll, 
    control, picker, stars, modalCard, actionView, growl, slidelist,
    bus, render, supports){

    var window = this,
        history = window.history,
        location = window.location,
        document = window.document,
        body = document.body,
        //back_timeout,
        gc_id = 0,

        TPL_MASK = '<div class="ck-viewmask"></div>';

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
            $(e.target).trigger(ev);
            return this;
        }
    });

    var tap_events = {

        'a': link_handler,
        'a *': link_handler,

        '.ck-card .ck-post-link': enable_control,

        '.ck-card .ck-post-button': enable_control,
        '.ck-card .ck-post-button span': function tap_ck_post(){
            if (!$(this).hasClass('ck-post-button')) {
                return tap_ck_post.call(this.parentNode);
            }
            enable_control.call(this);
        },

        '.ck-card .ck-switch span': function tap_ck_switch(){
            if (!$(this).hasClass('ck-switch')) {
                return tap_ck_switch.call(this.parentNode);
            }
            toggle_control.call(this);
        },

        '.ck-segment .ck-option': function(){
            var p = picker(this.parentNode, {
                ignoreRepeat: true
            });
            p.select(this);
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

        '.ck-actions-button, .ck-actions-button span': function(){
            var me = $(this);
            if (!me.hasClass('ck-actions-button')) {
                me = me.parent();
            }
            var opt = _.mix({
                confirmText: '确认',
                cancelText: '取消',
                multiselect: false
            }, me.data());
            opt.options = $(opt.options || '.ck-option', me);
            actionView(me, opt).open();
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

        '.ck-top-title': function(){
            if (this.href) {
                ck.openURL(this.href);
            }
        },

        '.ck-top-create .btn': open_modal_card,

        '.ck-top-action .btn': function(){
        
        }
    
    };

    function open_modal_card(){
        ck.openModal($(this).data());
    }

    function enable_control(){
        var controller = control(this);
        if (!controller.isEnabled) {
            controller.enable();
            mark_gc(controller);
        }
    } 

    function toggle_control(){
        var controller = control(this).toggle();
        mark_gc(controller);
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

    modalCard.event.bind('open', function(modalCard){
        ck.disableView = true;
        //ck.showTopbar();
        $(body).addClass('bg').addClass('modal-view');
        setTimeout(function(){
            choreo.transform(modalCard._wrapper[0], 'translateY', '0');
            var prev = ck.viewport,
                current = modalCard._contentWrapper;
            ck.changeView(current, { 
                isModal: true 
            });
            var h = current[0].offsetHeight*2;
            if (modalCard._iframeContent) {
                modalCard._iframeContent.css({
                    minHeight: h + 'px',
                    width: current[0].offsetWidth + 'px',
                    height: current[0].offsetHeight - ck.headerHeight + 'px'
                });
                modalCard.event.done('frameOnload', function(){
                    var iframe_body = $(modalCard._iframeWindow[0].document.body);
                    iframe_body.bind('touchstart', prevent_window_scroll);
                    ck.initView(iframe_body, {
                        isModal: true
                    });
                });
            } else if (!modalCard._content.html()) { // @TODO 换更靠谱的方法
                modalCard.event.done('contentchange', function(){
                    ck.initView(current, {
                        isModal: true
                    });
                });
            }
            modalCard._content.css('minHeight', h + 'px');
            modalCard.event.once('close', function(){
                ck.changeView(prev);
            });
        }, 200);
    }).bind('needclose', function(){
        ck.closeModal();
    });

    bus.bind('actionView:open', function(actionCard){
        ck.disableView = true;
        var prev = ck.viewport,
            current = actionCard._wrapper;
        ck.changeView(current, { 
            isModal: true 
        });
        var h = current[0].offsetHeight;
        actionCard._wrapperContent.css({
            height: h + 'px'
        });
        actionCard._node.css({
            height: h + 'px'
        });
        actionCard.event.once('close', function(){
            ck.changeView(prev);
        });
    }).bind('actionView:jump', function(actionCard, href, target){
        actionCard.event.once('close', function(){
            ck.openURL(href, { target: target });
        });
    });

    var ck = {

        init: function(opt){
            var root = this.root = opt.root;
            this.wrapper = $('.ck-wrapper', root);
            this.header = $('.ck-header', root);
            this.footer = $('.ck-footer', root);
            this.raw = $('.ck-raw', root);
            this.loadingCard = $('#ckLoading').data('rendered', '1');
            this.defaultCard = $('#ckDefault');
            this.scrollMask = $(TPL_MASK).appendTo(body);
            this.globalMask = $(TPL_MASK).appendTo(body);
            this.headerHeight = this.header.height();
            this.sizeInited = false;
            this.viewportGarbage = {};
            this.sessionLocked = true;
            this.initWindow();

            this.scrollGesture = momoScroll(document);
            momoTap(document);

            if (!supports.OVERFLOWSCROLL) {
                $(body).addClass('no-overflow-scrolling');
            }
            if (supports.SAFARI_TOPBAR) {
                $(body).addClass('mobilesafari-bar');
            }
            this.initState();

            setTimeout(function(){
                ck.hideAddressbar();
                ck.hideLoadingCard();
                ck.enableControl();
            }, 0);

            $(window).bind('resize', function(){
                var current = ck.isLandscape();
                if (current !== ck.landscapeMode) {
                    ck.initWindow();
                    ck.hideAddressbar(); // @TODO 无效
                }
            });

            soviet(document, {
                matchesSelector: true,
                preventDefault: true
            }).on('click', {
                'a': nothing,
                'a *': nothing
            }).on('tap', tap_events).on('touchend', {
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
            });

            $(document).bind('scrolldown', function(){
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
            }).bind('scrollstart', function(){
                ck.scrollMask.show();
            }).bind('scrollend', function(){
                ck.scrollMask.hide();
                prevent_window_scroll();
            }).bind('scroll', function(){
                if (modalCard.isOpened) {
                    var y = window.scrollY;
                    ck.hideAddressbar();
                    if (y > 40) {
                        ck.viewport[0].scrollTop = ck.viewport[0].scrollTop + y - 40;
                    }
                }
            });

            $(document).bind('touchstart', prevent_window_scroll);

            if (supports.SAFARI_TOPBAR) {

                var startY,
                    hold_timer,
                    topbar_holded,
                    topbar_tips = growl({
                        expires: -1,
                        keepalive: true,
                        content: '向下拖动显示地址栏'
                    }),
                    cancel_hold = function(){
                        clearTimeout(hold_timer);
                        if (topbar_holded) {
                            topbar_holded = false;
                            topbar_tips.close();
                        }
                    };
                this.header.bind('touchstart', function(e){
                    startY = e.touches[0].clientY;
                    hold_timer = setTimeout(function(){
                        topbar_holded = true;
                        ck.viewport[0].scrollTop = 0;
                        topbar_tips.open();
                    }, 200);
                }).bind('touchmove', function(e){
                    clearTimeout(hold_timer);
                    if (topbar_holded && e.touches[0].clientY < startY) {
                        cancel_hold();
                        topbar_holded = true;
                        ck.windowFullHeight = Infinity;
                        ck.hideAddressbar();
                    }
                }).bind('touchend', cancel_hold).bind('touchcancel', cancel_hold);

            }

        },

        initWindow: function(){
            this.landscapeMode = this.isLandscape();
            this.windowFullHeight = Infinity;
        },

        initState: function(){

            ck.sessionLocked = false;

            var travel_history, restore_state;

            if (supports.HISTORY) {
                $(window).bind("popstate", function(e){
                    // alert(['pop', e.state && [e.state.prev, e.state.next].join('-'), ck.viewport && ck.viewport[0].id].join(', '))
                    if (ck.sessionLocked) {
                        location.reload(true);
                        return;
                    }
                    //clearTimeout(back_timeout);
                    var loading = ck.viewport[0].id === 'ckLoading'; 
                    if (e.state) {
                        if (e.state.next === '_modal_') {
                            // 11. forward from normal card, show modal card.  alert(11)
                            if (modalCard.isOpened || loading || !ck.viewport) {
                                history.back();
                            } else {
                                modalCard.set(e.state.opt).open();
                            }
                        } else if (modalCard.isOpened) {
                            // 12. back from modal card.  alert(12)
                            ck.closeModal();
                        } else if (loading) {
                            if (e.state.next === 'ckLoading') {
                                // 6. back from other page, no GC. 
                                //    go to 2.  alert(6)
                                history.back();
                            } else if (e.state.next) {
                                // 7. from 6, hide loading immediately.  alert(7)
                                ck.changeView(e.state.next);
                                ck.hideLoadingCard();
                                ck.enableControl();
                            }
                        } else if (e.state.prev === ck.viewport[0].id) {
                            // 3. forward from normal card.  alert(3)
                            link_handler(e.state.next, e.state.link);
                        } else if (e.state.next === ck.viewport[0].id){ // @TODO hotfix for chrome
                            history.back();
                        } else {
                            // 2. back from normal card.  alert(2)
                            back_handler(e.state.next);
                        }
                    } else if (loading) {
                        // 5. forward from other page, no GC.  alert(5)
                        history.forward();
                    } else { 
                        // 4. back to other page, shift left and show loading.
                        //    if no GC: go to 6.
                        //    if no prev page: reload, go to 8
                        //    else: go to 8.  alert(4)
                        back_handler('ckLoading');
                    }
                });

                //console.info('is_back: ', is_back)
                //console.info('is_lastadd: ', is_lastadd)
                //console.info('is_refresh: ', is_refresh)
                //console.info('url: ', url)
                //console.info('ref: ', ref)
                //console.warn('lasturl: ', lasturl)
                //console.info('index: ', current, footprint.indexOf(url))
                //console.info('data: ', footprint)

                travel_history = check_footprint();

                var current_state = history.state,
                    restore_state = current_state && current_state.next; // alert(['init', current_state && [current_state.prev, current_state.next].join('-'), ck.viewport && ck.viewport[0].id].join(', '))
                if (restore_state === '_modal_') { // @TODO
                    restore_state = current_state.prev;
                    if (!modalCard.isOpened && ck.viewport) {
                        modalCard.set(history.state.opt).open();
                    }
                }

                //console.info(travel_history, restore_state, current_state)

            } else if (supports.PREVENT_CACHE) {

                $(window).bind("popstate", function(){
                    window.location.reload(true);
                });

            }

            if (restore_state) {
                // 1. reload from normal card.  alert(1)
                ck.changeView(restore_state);
                if (restore_state === 'ckLoading') {
                    // 9.  alert(9)
                    history.back();
                }
            } else {
                if (travel_history) {
                    // 8.  alert(8)
                    ck.changeView(ck.loadingCard);
                    history.forward();
                    //setTimeout(function(){
                        //if (ck.viewport === ck.loadingCard) {
                            //ck.initNewPage();
                        //}
                    //}, 100);
                } else {
                    // 0.  alert(0)
                    ck.initNewPage();
                }
            }

        },

        initNewPage: function(){
            ck.changeView(ck.defaultCard);
            push_history(ck.loadingCard[0].id, ck.defaultCard[0].id);
        },

        initView: function(card, opt){
            if (!card.data('rendered')) {
                render.initCard(card, this.raw, this.footer, opt);
                if (!opt.isModal) {
                    card.data('rendered', '1');
                }
                card.find('.ck-mini-unit').forEach(function(unit){
                    var slide = $('.ck-inslide', unit);
                    if (slide[0]) {
                        var pagers = $('.ck-page span', unit);
                        slidelist(slide).event.bind('change', function(n){
                            pagers.removeClass('enable');
                            pagers.eq(n).addClass('enable');
                        });
                    }
                });
            }
            this.watchScroll(card);
        },

        releaseView: function(){
            control.gc(check_gc);
            picker.gc(check_gc);
            this.viewportGarbage = {};
            gc_id = 0;
        },

        changeView: function(card, opt){
            opt = opt || {};
            //this.releaseView(); // @TODO release when modal open
            if (typeof card === 'string') {
                card = $('#' + card);
            }
            var is_loading = card === this.loadingCard;
            this.initView(card, opt);
            this.viewport = card.show();
            if (!is_loading) {
                this.updateSize();
            }
            if (!opt.isModal) {
                this.updateHeader();
            }
            sessionStorage['ck_lasturl'] = location.href;
            if (!is_loading) {
                bus.fire('readycardchange', [card]);
            }
        },

        updateSize: function(){
            this.viewport[0].style.height = (this.sizeInited ? 
                window.innerHeight : (screen.availHeight + 60)) + 'px';
            // enable scrollable when height is not enough 
            var ft = this.viewport.find('.ck-footer')[0];
            if (ft) {
                var d = screen.availHeight - (ft.offsetTop 
                        + ft.offsetHeight + this.viewport[0].scrollTop); 
                if (d > 0) {
                    ft.style.paddingTop = (parseFloat(ft.style.paddingTop) || 0) + d + 100 + 'px';
                }
            }
        },

        watchScroll: function(card){
            this.scrollGesture.watchScroll(card[0]);
        },

        updateHeader: function(){
            var top_submit = this.header.find('.ck-top-create').empty();
            var create_btn = this.viewport.find('.ckd-top-create').html();
            if (create_btn) {
                top_submit.append(create_btn);
            }
        },

        renderUnit: function(node){
            render.initUnit(node, this.raw);
        },

        hideLoadingCard: function() {
            if (!this._loadingAnimate) {
                this._loadingAnimate = choreo();
            }
            this._loadingAnimate.clear().play()
                .actor(ck.loadingCard[0], {
                    opacity: 0
                }, 400, 'easeInOut').follow().then(function(){
                    ck.loadingCard.hide().css({
                        position: 'static',
                        opacity: '',
                        height: window.innerHeight + 'px'
                    });
                    ck.showTopbar();
                });
        },

        hideTopbar: function(){
            if (this.topbarEnable && !this.disableView) {
                this.topbarEnable = false;
                choreo.transform(ck.header[0], 'translateY', '-' + this.headerHeight + 'px');
            }
        },

        showTopbar: function(){
            if (!this.topbarEnable) {
                this.topbarEnable = true;
                choreo.transform(ck.header[0], 'translateY', '0');
            }
        },

        hideAddressbar: function(){
            if (this.windowFullHeight > window.innerHeight) {
                if (!this.sizeInited) {
                    this.sizeInited = true;
                }
                this.loadingCard.find('div')[0].style.visibility = 'hidden';
                if (supports.SAFARI_TOPBAR) {
                    window.scrollTo(0, 1);
                    if (screen.availHeight - ck.viewport[0].offsetHeight 
                            > ck.headerHeight + 10) {
                        location.reload();
                        return;
                    }
                }
                this.windowFullHeight = window.innerHeight;
                ck.updateSize();
                this.loadingCard.find('div')[0].style.visibility = '';
            }
        },

        isLandscape: function() {
            return window.innerWidth / window.innerHeight > 1.1;
        },

        enableControl: function(){
            this.globalMask.hide();
            window.ckControl = enable_control;
        },

        disableControl: function(){
            this.globalMask.show();
            window.ckControl = disable_control;
        },

        showLoading: function(text){
            this.disableControl();
            if (!this.loadingTips) {
                this.loadingTips = growl({
                    expires: -1,
                    keepalive: true,
                    corner: 'center'
                }),
            }
            this.loadingTips.set({
                content: text || '正在加载...'
            }).open();
        },

        hideLoading: function(){
            if (this.loadingTips) {
                this.loadingTips.close();
            }
            this.enableControl();
        },

        openModal: function(opt){
            this.hideAddressbar();
            if (!modalCard.isOpened) {
                push_history(ck.viewport[0].id, '_modal_', false, opt);
            }
            modalCard.set(opt).open();
        },

        closeModal: function(){
            ck.disableView = false;
            $(body).removeClass('modal-view');
            choreo.transform(modalCard._wrapper[0], 'translateY', '100%');
            setTimeout(function(){
                $(body).removeClass('bg');
                modalCard.close();
            }, 400);
        },

        openURL: open_url,

        delegate: soviet(document, {
            autoOverride: true,
            matchesSelector: true,
            preventDefault: true
        }),

        event: bus,

        control: control,
        picker: picker,
        modalCard: modalCard,
        actionView: actionView, 
        growl: growl

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
            } else if (/(^|\s)ck-\w+/.test(me.className)) {
                return;
            } else if (me.target) {
                open_url(me.href, me);
                return;
            }
        }
        var next = next_id && $('#' + next_id);
        if (!next) {
            if (me) {
                next_id = 'ckLoading';
                next = ck.loadingCard;
                true_link = me.href;
            } else {
                return;
            }
        }
        if (supports.PREVENT_CACHE && next === ck.loadingCard) {
            if (true_link) {
                location.href = true_link;
            }
            return;
        }
        ck.sessionLocked = true;
        var current = ck.viewport;
        if (!is_forward) {
            push_history(current[0].id, next_id, true_link);
        }
        ck.disableControl();
        //ck.showTopbar();
        next.addClass('moving');
        ck.changeView(next);
        choreo().play().actor(ck.wrapper[0], {
            'transform': 'translateX(' + (0 - window.innerWidth) + 'px)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide();
            choreo.transform(ck.wrapper[0], 'translateX', '0');
            next.removeClass('moving');
            //ck.enableControl();
            ck.sessionLocked = false;
            if (true_link) {
                if (is_forward && supports.HISTORY) {
                    history.forward();
                } else {
                    location.href = true_link;
                }
            } else {
                ck.enableControl();
            }
        });
    }

    function back_handler(prev_id){
        ck.sessionLocked = true;
        var prev = $('#' + prev_id);
        var current = ck.viewport;
        if (actionView.current) {
            actionView.current.close();
        }
        //if (supports.PREVENT_CACHE && prev === ck.loadingCard) {
            //ck.sessionLocked = false;
            //history.back();
            //return;
        //}
        ck.disableControl();
        //ck.showTopbar();
        choreo.transform(ck.wrapper[0], 'translateX', 0 - window.innerWidth + 'px');
        current.addClass('moving');
        prev.show();
        ck.changeView(prev);
        choreo().play().actor(ck.wrapper[0], {
            'transform': 'translateX(0)'
        }, 400, 'easeInOut').follow().done(function(){
            current.hide().removeClass('moving');
            ck.enableControl();
            ck.sessionLocked = false;
            if (prev_id === 'ckLoading') {
                history.back();
                //back_timeout = setTimeout(function(){
                    //location.reload(true);
                //}, 800);
            }
        });
    }

    function push_history(prev_id, next_id, link, opt){
        if (supports.HISTORY) {
            history.pushState({
                prev: prev_id,
                next: next_id,
                link: link,
                opt: opt,
                i: history.length
            }, document.title, location.href);
        }
    }

    function check_footprint(){
        var footprint = sessionStorage['ck_footprint'];
        try {
            footprint = footprint && JSON.parse(footprint) || [];
        } catch(ex) {
            footprint = [];
        }
        var url = location.href,
            ref = document.referrer,
            lasturl = sessionStorage['ck_lasturl'],
            current = footprint.lastIndexOf(url),
            is_refresh = lasturl === url && ref !== url,
            is_first = url === footprint[0],
            is_lastadd = url === footprint[footprint.length - 1],
            is_back = lasturl && lasturl !== ref && !is_refresh;
        if ((is_back || is_refresh) && is_first) {
            return;
        }
        if (ref) {
            if (ref === url) {
                footprint.length = 0;
                footprint.push(url);
            } else if (!is_back && ref === footprint[footprint.length - 1]) {
                if (current !== -1) { 
                    footprint.splice(0, current + 1);
                }
                footprint.push(url);
            } else if (is_back && lasturl === footprint[0]) {
                if (current !== -1) { 
                    footprint.length = current - 1;
                }
                footprint.unshift(url);
            } else if (ref === footprint[current - 1]) {
                return true; // travel_history
            } else if (ref === footprint[footprint.length - 2]
                    && is_lastadd && !is_back) {
                return;
            } else {
                footprint.length = 0;
                footprint.push(url);
            }
        } else if (is_lastadd) {
            return;
        } else {
            footprint.length = 0;
            footprint.push(url);
        }
        sessionStorage['ck_footprint'] = JSON.stringify(footprint);
        //console.warn('changed: ', sessionStorage['ck_footprint'])
    }

    function prevent_window_scroll(){
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
        if (modalCard.isOpened) {
            modalCard.event.once('close', function(){
                open_url(true_link, opt);
            });
            ck.closeModal();
            return;
        }
        if (opt.target !== '_self') {
            window.open(true_link, opt.target);
        } else {
            if (supports.PREVENT_CACHE) {
                location.href = true_link;
                return;
            }
            ck.sessionLocked = true;
            var next_id = 'ckLoading';
            var next = ck.loadingCard;
            var current = ck.viewport;
            ck.disableControl();
            push_history(current[0].id, next_id, true_link);
            ck.changeView(next);
            setTimeout(function(){
                current.hide();
                //ck.enableControl();
                ck.sessionLocked = false;
                location.href = true_link;
            }, 10);
        }
    }

    function check_gc(controller){
        return ck.viewportGarbage[controller.parentId];
    }

    function enable_control(){}

    function disable_control(){ return false; }

    return ck;

});

/* autogeneration */
define("../cardkit/app", [], function(){});

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
        PREV_SIB = 'prevElementSibling',
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
                _array_push[selector.push === _array_push 
                    ? 'apply' : 'call'](nodes, selector);
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
                var elm = (contexts[0] || doc).getElementById(selector.substr(1));
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

        bind: event_access('add'),

        unbind: event_access('remove'),

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
        event[is_touch && 'initTouchEvent' 
            || 'initEvent'](type, bubbles, true);
        return event;
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
    $.trigger = trigger;
    $._kvAccess = kv_access;
    $._eachNode = each_node;

    $.VERSION = '1.1.2';

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

/* @source  */;


require.config({
    baseUrl: 'js/mod/',
    distUrl: 'dist/js/mod/',
    aliases: {
        'cardkit': '../cardkit/'
    }
});

define('mo/lang/es5', [], function(){});
define('mo/mainloop', [], function(){});

define('cardkit/env', [], function(){
    return {};
});

define('cardkit/pageready', [
    'finish', 
    'cardkit/bus'
], function(finish, bus){
    bus.once('readycardchange', finish);
});

require([
    'dollar', 
    'cardkit/app',
    'cardkit/env'
], function($, app, env){

    if (env.enableConsole) {
        require(['mo/console'], function(console){
            init();
            console.config({
                output: $('#console')[0]
            }).enable();
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
