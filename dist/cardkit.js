
/* @source cardkit/bus.js */;


define("cardkit/bus", [
  "eventmaster"
], function(event){

    return event();

});


/* @source cardkit/supports.js */;


define("cardkit/supports", [
  "mo/browsers"
], function(browsers){

    var div = document.createElement('div');

    var exports = {
        touch: browsers.isTouch,
        overflowScroll: "webkitOverflowScrolling" in document.body.style,
        JSON: !!window.JSON,
        dataset: 'dataset' in div
    };

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
    _.mix(opt, exports.forceOptions);
    var g = growl(opt);
    if (id) {
        lib[id] = g;
    }
    return g;
}

exports.forceOptions = {};

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

/* @source cardkit/ui/modalview.js */;

define("cardkit/ui/modalview", [
  "mo/lang",
  "dollar",
  "mo/network",
  "moui/modalview"
], function(_, $, net, originModal) {

var default_config = {
        className: 'ck-modalview',
        openDelay: 400,
        closeDelay: 400,
        oldStylePage: false,
        contentFilter: false
    },
    SCRIPT_TYPES = {
        'text/darkscript': 1,
        'text/cardscript': 1,
        'text/jscode': 1
    },
    singleton,
    _tm;

var ModalView = _.construct(originModal.ModalView);

_.mix(ModalView.prototype, {

    _defaults: _.mix({}, ModalView.prototype._defaults, default_config),

    init: function() {
        this.superMethod('init', arguments);
        this.event.bind('confirm', function(modal){
            modal.event.fire('confirmOnThis', arguments);
        }).bind('close', function(modal){
            _tm = 0;
            modal.event.unbind('confirmOnThis');
        });
        return this;
    },

    set: function(opt){
        if (!opt) {
            return this;
        }

        var self = this,
            tm = +new Date(),
            url = opt.jsonUrl || opt.url;
        if (url) {
            opt.content = '';
            self.showLoading();
            _tm = tm;
            if (opt.jsonUrl) {
                net.getJSON(url, callback);
            } else if (opt.url) {
                net.ajax({
                    url: url,
                    success: callback
                });
            }
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

        function callback(data){
            if (tm !== _tm) {
                return;
            }
            if (opt.jsonUrl) {
                data = data.html;
            }
            self.setContent(data);
            self.hideLoading();
        }

        return this.superMethod('set', [opt]);
    },

    setContent: function(html){
        if (html) {
            var filter = this._config.contentFilter;
            if (filter) {
                html = (new RegExp(filter).exec(html) || [])[1];
            }
            var oldstyle = this._config.oldStylePage;
            var page_start = oldstyle 
                ? '<div class="ckd-page-card ck-modal-page" ' 
                    + 'data-cfg-deck="modalview" '
                    + 'id="ckPage-' + this.id + '">'
                : '<ck-card type="page" class="ck-modal-page" ' 
                    + 'deck="modalview" '
                    + 'id="ckPageOld-' + this.id + '">';
            var page_end = oldstyle ? '</ck-card>' : '</div>';
            html = page_start + html + page_end;
        }
        return this.superMethod('setContent', [html]);
    },

    pageNode: function(){
        return this._content.find('.ck-modal-page');
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

/* @source cardkit/ui/ranger.js */;

define("cardkit/ui/ranger", [
  "moui/ranger",
  "cardkit/bus",
  "cardkit/ui/growl",
  "cardkit/ui/util"
], function(ranger, bus, growl, util){

return util.singleton({

    flag: '_ckRangerUid',

    factory: function(elm, opt){
        return ranger(elm, opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.notify = growl({
            parent: source.parent(),
            corner: 'stick'
        });
        o.event.bind('change', function(v){
            o.notify.set({
                content: v
            }).open();
        }).bind('changed', function(){
            var url = source.trigger('ranger:changed', {
                component: o
            }).data('url');
            bus.fire('ranger:changed', [o, url]);
        }).bind('changeEnd', function(){
            o.notify.close();
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

/* @source cardkit/ui.js */;


define("cardkit/ui", [
  "mo/lang",
  "dollar",
  "mo/browsers",
  "mo/template",
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
], function(_, $, browsers, tpl, soviet, 
    momoBase, momoTap,
    control, picker, ranger, 
    modalView, actionView, growl, supports, bus){

var doc = document,
    modalCard = modalView(),
    _soviet_aliases = {};

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
        bus.on('actionView:confirmOnThis', function(actions){
            p.select(actions.val());
        });
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
        modalCard.set(opt).open();
    },

    closeModal: function(){
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
            content: text || '正在加载...'
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
        growl.forceOptions.parent = wrapper;
        modalCard.set({
            oldStylePage: opt.oldStyle,
            parent: wrapper
        });
        var tapGesture = momoTap(doc, {
            tapThreshold: 20 
        });
        set_alias_events(tapGesture.event);
        var prevent_click_events = {};
        Object.keys(tap_events).forEach(function(selector){
            this[selector] = nothing;
        }, prevent_click_events);
        this.delegate.on('tap', tap_events)
            .on('click', prevent_click_events)
            .on('change', {
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

    delegate: soviet(doc, {
        aliasEvents: _soviet_aliases,
        autoOverride: true,
        matchesSelector: true,
        preventDefault: true
    }),

    action: actions,
    component: components

};


function handle_control(){
    var controller = control(this, {
            disableRequest: this.isMountedDarkDOM
        }),
        cfg = controller.data();
    if (cfg.disableUrl || cfg.disableJsonUrl) {
        controller.toggle();
    } else if (!controller.isEnabled) {
        controller.enable();
    }
} 

function toggle_control(){
    control(this, {
        disableRequest: this.isMountedDarkDOM
    }).toggle();
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


/* @source cardkit/helper.js */;


define("cardkit/helper", [
  "mo/lang",
  "dollar",
  "cardkit/ui"
], function(_, $, ui){

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

    forwardUserEvents: function(component){
        component.forward({
            'control:enable *': 'control:enable',
            'control:disable *': 'control:disable',
            'picker:change *': 'picker:change'
        });
    },

    applyUserEvents: function(guard){
        guard.forward({
            'control:enable': forward_enable,
            'control:disable': forward_disable,
            'picker:change': forward_pick
        });
    },

    isBlank: function(content){
        return !content || !/\S/m.test(content);
    }

};

function forward_enable(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            ui.component.control(node, {
                disableRequest: true
            }).enable();
        }
    }
}

function forward_disable(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            ui.component.control(node, {
                disableRequest: true
            }).disable();
        }
    }
}

function forward_pick(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            ui.component.picker(node, {
                disableRequest: true
            }).select(e.component.val());
        }
    }
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
], function($, helper,
    scaffold_specs, source_scaffold_specs, item_specs, source_item_specs){ 

var SEL = 'ck-card[type="list"]';

var source_item_states = {
    link: 'href',
    linkTarget: function(node){
        return node.hasClass('ckd-title-link-extern') 
            && (node.attr('target') || '_blank');
    },
    isAlone: function(node){
        return node.hasClass('ckd-title-link-alone');
    }
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
        plainHdStyle: 'plain-hd-style'
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('ck-part[type="item"]');
        guard.state({
            link: 'href',
            linkTarget: 'target',
            isAlone: 'alone-mode'
        });
        guard.component(item_specs);
        guard.source().component(source_item_specs);
    });
    helper.applyUserEvents(guard);
    guard.source().component(source_scaffold_specs);
    guard.source().component('item', source_item_spec);
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
        plainHdStyle: 'data-cfg-plainhd'
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
    helper.applyUserEvents(guard);
    guard.source().component(scaffold_specs);
    guard.source().component('item', source_item_spec);
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
        plainHdStyle: 'data-cfg-plainhd'
    });
    guard.component(scaffold_specs);
    guard.component('content', function(guard){
        guard.watch('.ckd-content');
        guard.state(source_states);
    });
    helper.applyUserEvents(guard);
    guard.source().component(scaffold_specs);
    guard.source().component('content', '.ckd-content');
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

function source_item_spec(guard){
    guard.watch('.ckd-item');
    guard.component('content', '.ckd-content');
}

function exports(guard, parent){
    guard.watch($(SEL, parent));
    guard.state({
        subtype: 'subtype',
        blankText: 'blank-text',
        plainHdStyle: 'plain-hd-style'
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('ck-part[type="item"]');
        guard.component('content', 'ck-part[type="content"]');
        guard.forward({
            'textarea:change': forward_textchange
        });
        guard.source().component('content', '.ckd-content');
    });
    helper.applyUserEvents(guard);
    guard.source().component(source_scaffold_specs);
    guard.source().component('item', source_item_spec);
}

function forward_textchange(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            node.val(e.target.value);
        }
    }
}

exports.sourceItemSpec = source_item_spec;

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
    source_item_spec = form_spec.sourceItemSpec,
    SEL = '.ckd-form-card',
    SEL_OLD = '.ck-form-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    guard.state({
        subtype: 'data-style',
        blankText: 'data-cfg-blank',
        plainHdStyle: 'data-cfg-plainhd'
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('.ckd-item');
        guard.component('content', function(guard){
            guard.watch('.ckd-content');
            guard.state(source_states);
        });
        guard.source().component('content', '.ckd-content');
    });
    helper.applyUserEvents(guard);
    guard.source().component(scaffold_specs);
    guard.source().component('item', source_item_spec);
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
  "cardkit/helper",
  "cardkit/spec/common/scaffold",
  "cardkit/spec/common/source_scaffold"
], function($, helper, scaffold_specs, source_scaffold_specs){ 

var SEL = 'ck-card[type="box"]';

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.state({
        subtype: 'subtype',
        paperStyle: 'paper-style',
        plainStyle: 'plain-style',
        plainHdStyle: 'plain-hd-style'
    });
    guard.component(scaffold_specs);
    guard.component('content', 'ck-part[type="content"]');
    helper.applyUserEvents(guard);
    guard.source().component(source_scaffold_specs);
    guard.source().component('content', '.ckd-content');
};

});


/* @source cardkit/spec/page.js */;


define("cardkit/spec/page", [
  "dollar",
  "darkdom",
  "cardkit/helper",
  "cardkit/spec/box",
  "cardkit/spec/list",
  "cardkit/spec/mini",
  "cardkit/spec/form"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, require){ 

var $ = require("dollar"),
    darkdom = require("darkdom"),
    helper = require("cardkit/helper"),
    UNMOUNT_FLAG = '.unmount-page';

var specs = {
    title: 'ck-part[type="title"]',
    actionbar: actionbar_spec,
    nav: nav_spec,
    banner: banner_spec,
    footer: 'ck-part[type="footer"]',
    blank: blank_spec,
    box: require("cardkit/spec/box"),
    list: require("cardkit/spec/list"),
    mini: require("cardkit/spec/mini"),
    form: require("cardkit/spec/form"),
};

function blank_spec(guard){
    guard.watch('ck-part[type="blank"]');
}

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
    exports.forwardActionbar(guard);
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

function forward_control(e){
    var target = darkdom.getDarkById(e.target.parentNode.id);
    if (target) {
        target.trigger('tap').updateDarkDOM();
    }
}

function exports(guard, parent){
    guard.watch($(exports.SELECTOR + UNMOUNT_FLAG, parent));
    guard.state({
        blankText: 'blank-text',
        deck: 'deck',
        isPageActive: 'active-page',
        isDeckActive: 'active-deck',
        currentDeck: 'current-deck',
        cardId: 'id'
    });
    guard.component(specs);
}

exports.SELECTOR = 'ck-card[type="page"]';

exports.initOldStyleActionState = source_action_attr;

exports.forwardActionbar = function(guard){
    guard.forward({
        'overflows:confirm': function(e){
            var aid = e.component.val();
            var target = $('#' + aid).children();
            target.trigger('tap');
        },
        'control:enable': forward_control,
        'control:disable': forward_control
    });
};

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
    title: '.ckd-page-title',
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

function blank_spec(guard){
    guard.watch('.ckd-page-blank');
}

function nav_spec(guard){
    guard.watch('.ckd-page-nav');
    guard.state({
        link: 'href'
    });
}

function banner_spec(guard){
    guard.watch('.ckd-page-banner');
    guard.watch('.ck-banner-unit'); // @deprecated
    guard.state({
        plainStyle: 'data-cfg-plain'
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
    newspec.forwardActionbar(guard);
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
        cardId: 'id'
    });
    guard.component(specs);
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

    return {"template":"<div class=\"ck-item {%= (itemLink && 'clickable' || '') %}\" \n        style=\"width:{%= (context.state.col ? Math.floor(1000/context.state.col)/10 + '%' : '') %};\">\n\n    <div class=\"ck-initem\">\n\n        {% if (itemLink && !isItemLinkAlone) { %}\n        <a href=\"{%= itemLink %}\" \n            target=\"{%= (itemLinkTarget || '_self') %}\"\n            class=\"ck-link-mask ck-link\"></a>\n        {% } %}\n\n        <div class=\"ck-title-box\">\n\n            {%= component.opt.join('') %}\n            {%= component.icon %}\n\n            <div class=\"ck-title-set\">\n\n                {% if (itemContent) { %}\n                <div class=\"ck-title-line\">\n                    {%= component.titlePrefix.join('') %}\n                    {%= itemContent %}\n                    {%= component.titleSuffix.join('') %}\n                    {%= component.titleTag.join('') %}\n                </div>\n                {% } %}\n\n                {% if (component.info.length) { %}\n                <div class=\"ck-info-wrap\">\n                    {%= component.info.join('') %}\n                </div>\n                {% } %}\n\n                {% if (component.desc.length) { %}\n                <div class=\"ck-desc-wrap\">\n                    {%= component.desc.join('') %}\n                </div>\n                {% } %}\n\n            </div>\n\n            {% if (component.content.length) { %}\n            <div class=\"ck-content-wrap\">\n                {%= component.content.join('') %}\n            </div>\n            {% } %}\n\n            {% if (component.meta.length) { %}\n            <div class=\"ck-meta-wrap\">\n                {%= component.meta.join('') %}\n            </div>\n            {% } %}\n\n        </div>\n\n        {% if (component.author || component.authorDesc.length || component.authorMeta.length) { %}\n        <div class=\"ck-author-box\">\n\n            {%= component.avatar %}\n\n            <div class=\"ck-author-set\">\n\n                <div class=\"ck-author-line\">\n                    {%= component.authorPrefix.join('') %}\n                    {%= component.author %}\n                    {%= component.authorSuffix.join('') %}\n                </div>\n\n                {% if (component.authorInfo.length) { %}\n                <div class=\"ck-author-info-wrap\">\n                    {%= component.authorInfo.join('') %}\n                </div>\n                {% } %}\n\n                {% if (component.authorDesc.length) { %}\n                <div class=\"ck-author-desc-wrap\">\n                    {%= component.authorDesc.join('') %}\n                </div>\n                {% } %}\n\n            </div>\n\n            {% if (component.authorMeta.length) { %}\n            <div class=\"ck-author-meta-wrap\">\n                {%= component.authorMeta.join('') %}\n            </div>\n            {% } %}\n\n        </div>\n        {% } %}\n\n    </div>\n\n</div>\n\n"}; 

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

    return {"template":"<div class=\"ck-list-card{%= (state.blankText === 'false' ? ' no-blank' : '') %}\"\n        data-style=\"{%= state.subtype %}\"\n        {%= state.col ? 'data-cfg-col=\"' + state.col + '\" ' : '' %}\n        {%= state.paperStyle ? 'data-cfg-paper=\"true\" ' : '' %}\n        {%= state.plainStyle ? 'data-cfg-plain=\"true\" ' : '' %}\n        {%= state.plainHdStyle ? 'data-cfg-plainhd=\"true\" ' : '' %}>\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n        \n        <div class=\"ck-list-wrap\">\n\n            {% if (component.item.length) { %}\n\n                <div class=\"ck-list\">\n                {% component.item.forEach(function(item, i){ %}\n\n                    {% if (i && (i % state.col === 0)) { %}\n                    </div><div class=\"ck-list\">\n                    {% } %}\n\n                    {%= item %}\n\n                {% }); %}\n                </div>\n\n            {% } else { %}\n\n                <div class=\"ck-list\">\n                    <div class=\"ck-item blank\">\n                        <div class=\"ck-initem\">\n                        {% if (component.blank) { %}\n                            {%= component.blank %}\n                        {% } else { %}\n                            {%=(state.blankText || '目前还没有内容')%}\n                        {% } %}\n                        </div>\n                    </div>\n                </div>\n\n            {% } %}\n\n        </div>\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n\n"}; 

});
/* @source cardkit/tpl/scaffold/hdwrap.js */;

define("cardkit/tpl/scaffold/hdwrap", [], function(){

    return {"template":"\n{% if (component.hd) { %}\n<header class=\"ck-hd-wrap\">\n\n    {%= component.hd %}\n\n    {% if (component.hdOpt.length) { %}\n        <div class=\"ck-hdopt-wrap\">\n            {%= component.hdOpt.join('') %}\n        </div>\n    {% } %}\n\n</header>\n{% } %}\n"}; 

});
/* @source cardkit/card/list.js */;


define("cardkit/card/list", [
  "darkdom",
  "mo/template/micro",
  "cardkit/helper",
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/list",
  "cardkit/card/item",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
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
        helper.forwardUserEvents(list);
        return list;
    }

};

return exports;

});


/* @source cardkit/tpl/box.js */;

define("cardkit/tpl/box", [], function(){

    return {"template":"<div class=\"ck-box-card\"\n        data-style=\"{%= state.subtype %}\"\n        {%= state.paperStyle ? 'data-cfg-paper=\"true\" ' : '' %}\n        {%= state.plainStyle ? 'data-cfg-plain=\"true\" ' : '' %}\n        {%= state.plainHdStyle ? 'data-cfg-plainhd=\"true\" ' : '' %}>\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n\n        {% if (!isBlank) { %}\n            <section>{%= content %}</section>\n        {% } %}\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n"}; 

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
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/box",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
    render_content = convert(require("cardkit/tpl/box/content").template),
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

    box: function(){
        var box = darkdom({
            enableSource: true,
            render: function(data){
                data.isBlank = helper.isBlank(data.content);
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
        helper.forwardUserEvents(box);
        return box;
    }

};

return exports;

});


/* @source cardkit/tpl/form.js */;

define("cardkit/tpl/form", [], function(){

    return {"template":"<div class=\"ck-form-card{%= (state.blankText === 'false' ? ' no-blank' : '') %}\"\n        data-style=\"{%= state.subtype %}\"\n        {%= state.plainHdStyle ? 'data-cfg-plainhd=\"true\" ' : '' %}>\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n\n        {% if (component.item.length) { %}\n            {% component.item.forEach(function(item){ %}\n                {%= item %}\n            {% }); %}\n        {% } else { %}\n            <div class=\"ck-item blank\">\n            {% if (component.blank) { %}\n                {%= component.blank %}\n            {% } else { %}\n                {%=(state.blankText || '目前还没有内容')%}\n            {% } %}\n            </div>\n        {% } %}\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n"}; 

});
/* @source cardkit/tpl/form/item.js */;

define("cardkit/tpl/form/item", [], function(){

    return {"template":"<div class=\"ck-item\">{%= content %}</div>\n"}; 

});
/* @source cardkit/card/form.js */;


define("cardkit/card/form", [
  "darkdom",
  "mo/template/micro",
  "cardkit/helper",
  "cardkit/tpl/form/item",
  "cardkit/tpl/box/content",
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/form",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, __oz7, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
    render_item = convert(require("cardkit/tpl/form/item").template),
    render_content = convert(require("cardkit/tpl/box/content").template),
    render_hdwrap = convert(require("cardkit/tpl/scaffold/hdwrap").template),
    render_form = convert(require("cardkit/tpl/form").template),
    scaffold_components = require("cardkit/card/common/scaffold");

var exports = {

    content: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_content
        });
    },

    item: function(){
        return darkdom({
            enableSource: true,
            render: render_item
        }).contain('content', exports.content, {
            content: true
        }).forward({
            'change input': 'textarea:change',
            'change textarea': 'textarea:change'
        });
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
        helper.forwardUserEvents(form);
        return form;
    }

};

return exports;

});


/* @source cardkit/tpl/mini.js */;

define("cardkit/tpl/mini", [], function(){

    return {"template":"<div class=\"ck-mini-card{%= (state.blankText === 'false' ? ' no-blank' : '') %}\"\n        data-style=\"{%= state.subtype %}\">\n\n    {% if (hasSplitHd) { %}\n        {%= hdwrap %}\n    {% } %}\n\n    <article class=\"ck-card-wrap {%= (component.item.length > 1 ? 'slide' : '') %}\">\n\n        {% if (!hasSplitHd) { %}\n            {%= hdwrap %}\n        {% } %}\n        \n        <div class=\"ck-list-wrap\">\n\n            {% if (component.item.length) { %}\n\n                <div class=\"ck-list\" style=\"width:{%= listWidth %};\">\n                {% component.item.forEach(function(item){ %}\n                    <div class=\"ck-col\" style=\"width:{%= itemWidth %};\">\n                        {%= item %}\n                    </div>\n                {% }); %}\n                </div>\n\n            {% } else { %}\n\n                <div class=\"ck-list\">\n                    <div class=\"ck-item blank\">\n                        <div class=\"ck-initem\">\n                        {% if (component.blank) { %}\n                            {%= component.blank %}\n                        {% } else { %}\n                            {%=(state.blankText || '目前还没有内容')%}\n                        {% } %}\n                        </div>\n                    </div>\n                </div>\n\n            {% } %}\n\n        </div>\n\n        {%= component.ft %}\n\n    </article>\n\n</div>\n\n"}; 

});
/* @source cardkit/card/mini.js */;


define("cardkit/card/mini", [
  "darkdom",
  "mo/template/micro",
  "cardkit/helper",
  "cardkit/tpl/scaffold/hdwrap",
  "cardkit/tpl/mini",
  "cardkit/card/item",
  "cardkit/card/common/scaffold"
], function(__oz0, __oz1, __oz2, __oz3, __oz4, __oz5, __oz6, require){

var darkdom = require("darkdom"),
    convert = require("mo/template/micro").convertTpl,
    helper = require("cardkit/helper"),
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
        helper.forwardUserEvents(mini);
        return mini;
    }

};

return exports;

});


/* @source cardkit/tpl/page.js */;

define("cardkit/tpl/page", [], function(){

    return {"template":"\n<div class=\"ck-page-card{%= !hasHeader ? ' no-header' : '' %}{%= !component.banner || componentData.banner.isBlank ? '' : ' with-banner' %}{%= state.isPageActive === 'true' ? ' topbar-enabled' : '' %}\" \n        data-style=\"{%= state.subtype %}\"\n        data-page-active=\"{%= state.isPageActive || 'false' %}\"\n        data-deck-active=\"{%= state.isDeckActive || 'false' %}\"\n        data-deck=\"{%= (state.deck || 'main') %}\"\n        data-curdeck=\"{%= state.currentDeck %}\"\n        data-cardid=\"{%= state.cardId %}\">\n\n    {% if (hasHeader) { %}\n    <div class=\"ck-header\">\n        {%= component.nav %}\n        {%= component.title %}\n        {%= component.actionbar %}\n    </div>\n    {% } %}\n\n    {%= component.banner %}\n\n    <div class=\"ck-article\">\n        {% if (!isBlank) { %}\n            {%= content %}\n        {% } else { %}\n            <div class=\"ck-blank-card\">\n                <article class=\"ck-card-wrap\">\n                    {% if (component.blank) { %}\n                        {%= component.blank %}\n                    {% } else { %}\n                        <div>{%=(state.blankText || '目前还没有内容')%}</div>\n                    {% } %}\n                </article>\n            </div>\n        {% } %}\n    </div>\n\n    {% if (component.footer) { %}\n    <div class=\"ck-footer\">{%= component.footer %}</div>\n    {% } %}\n\n    <a class=\"ck-page-link-mask ck-link\" href=\"#{%= state.cardId %}\"></a>\n\n</div>\n\n"}; 

});
/* @source cardkit/tpl/page/actionbar/action.js */;

define("cardkit/tpl/page/actionbar/action", [], function(){

    return {"template":"\n<span class=\"ck-item\">\n    <button type=\"button\" class=\"ck-option\" \n        value=\"{%= id %}\">{%= state.label %}</button>\n    {%= content %}\n</span>\n"}; 

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
        return darkdom({
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
        }).contain('action', exports.action)
            .forward('control:enable .ck-item > *', 
                'control:enable')
            .forward('control:disable .ck-item > *', 
                'control:disable')
            .forward('actionView:confirm .ck-top-overflow', 
                'overflows:confirm');
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
        return page;
    }

};

function when_page_active(changes){
    if (changes.newValue === 'true') {
        changes.root.css('min-height', window.innerHeight * 1.4 + 'px')
            .attr('data-page-active', true);
        setTimeout(function(){
            changes.root.addClass('topbar-enabled');
            window.scrollTo(0, 0);
        }, 100);
    } else {
        changes.root.attr('data-page-active', false)
            .removeClass('topbar-enabled');
    }
    return false;
}

function when_deck_active(changes){
    if (changes.newValue === 'true') {
        changes.root.css('min-height', window.innerHeight * 1.4 + 'px')
            .attr('data-deck-active', true);
    } else {
        changes.root.attr('data-deck-active', false);
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
  "mo/browsers",
  "cardkit/spec",
  "cardkit/oldspec",
  "cardkit/ui",
  "cardkit/supports",
  "cardkit/bus"
], function(_, $, browsers,
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
        oldStyle: false 
    };

var exports = {

    init: function(opt){
        this._config = _.config({}, opt, _defaults);
        this.initSpec();
        this.initView();
    },

    initSpec: function(){
        _.each(specs, function(data, name){
            var spec = this._config.oldStyle 
                ? oldspecs[name][0] : data[0];
            this.component(name, data[1][name]());
            this.spec(name, spec);
        }, this);
    },

    initView: function(){
        this.wrapper = $(this._config.appWrapper || body);
        if (browsers.webview) {
            this.wrapper.addClass('ck-in-webview');
        }
        $(window).on('hashchange', function(){
            exports.openPage();
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

    spec: function(name, spec){
        if (spec) {
            _specs[name] = spec;
        } else {
            return _specs[name];
        }
    },

    guard: function(name){
        if (!_guards[name]) {
            _guards[name] = this.component(name).createGuard();
        }
        return _guards[name];
    },

    render: function(name, parent){
        var spec = this.spec(name);
        var guard = this.guard(name);
        if (spec && guard) {
            spec(guard, parent);
            guard.mount();
        }
    },

    openPage: function(page){
        page = this.findPage(page);
        if (_page_opening || !page[0] 
                || !this.isPage(page)) {
            return false;
        }
        window.scrollTo(0, 0);
        var last_decktop = _decks[DEFAULT_DECK];
        if (!last_decktop) {
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
            _current_deck = deck;
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
        open_page(page);
        focus_page(page);
        _page_opening = false;
        return true;
    },

    resetPage: function(page){
        page = this.findPage(page);
        if (!page[0]) {
            return;
        }
        page.resetDarkDOM();
    },

    findPage: function(page){
        if (!page || typeof page === 'string') {
            var hash = RE_HASH.exec(location.href);
            page = page 
                || hash && hash[1] 
                || this._config.defaultPage;
            page = $('#' + page);
        } else {
            page = $(page);
        }
        return page;
    },

    isPage: function(page){
        var spec = (this._config.oldStyle 
            ? oldspecs : specs)['page'][0];
        return page.is(spec.SELECTOR)
            || spec.SELECTOR_OLD 
                && page.is(spec.SELECTOR_OLD);
    },

    isLandscape: function() {
        return window.innerWidth / window.innerHeight > 1.1;
    },

    delegate: ui.delegate,
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
    exports.resetPage(modal.pageNode());
}).on('close', function(modal){
    exports.openPage(modal.lastDecktop);
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
