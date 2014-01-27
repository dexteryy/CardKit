
define('cardkit', [
    'mo/lang',
    'dollar',
    'mo/browsers',
    'cardkit/spec',
    'cardkit/oldspec',
    'cardkit/ui',
    'cardkit/supports',
    'cardkit/bus'
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
        supportOldVer: true 
    };

var exports = {

    init: function(opt){
        this._config = _.config({}, opt, _defaults);
        this.initSpec();
        this.initView();
    },

    initSpec: function(){
        var support_old = this._config.supportOldVer;
        _.each(specs, function(data, name){
            this.component(name, data[1][name]());
            this.spec(name, data[0], 'default');
            if (support_old && oldspecs[name]) {
                this.spec(name, oldspecs[name][0], 'old');
            }
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

    spec: function(name, spec, serie){
        if (!_.isFunction(spec)) {
            serie = spec;
            spec = null;
        }
        if (!serie) {
            if (!spec) {
                var re = {};
                _.each(_specs, function(specs, serie){
                    this[serie] = specs[name];
                }, re);
                return re;
            }
            serie = 'default';
        }
        var specs = _specs[serie];
        if (!specs) {
            specs = _specs[serie] = {};
        }
        if (spec) {
            specs[name] = spec;
        } else {
            return specs[name];
        }
    },

    guard: function(name, serie){
        var guards = _guards[serie];
        if (!guards) {
            guards = _guards[serie] = {};
        }
        if (!guards[name]) {
            guards[name] = this.component(name).createGuard();
        }
        return guards[name];
    },

    render: function(name, parent){
        var series = this.spec(name);
        _.each(series, function(spec, serie){
            var guard = this.guard(name, serie);
            spec(guard, parent);
            guard.mount();
        }, this);
    },

    openPage: function(page){
        if (!page || typeof page === 'string') {
            var hash = RE_HASH.exec(location.href);
            page = page 
                || hash && hash[1] 
                || this._config.defaultPage;
            page = $('#' + page);
        } else {
            page = $(page);
        }
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

    isPage: function(page){
        var spec = specs['page'][0];
        var old_spec = oldspecs['page'][0];
        return page.is(spec.SELECTOR)
            || page.is(old_spec.SELECTOR)
            || page.is(old_spec.SELECTOR_OLD);
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
