
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
    exports.openPage(modal.lastDecktop);
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
