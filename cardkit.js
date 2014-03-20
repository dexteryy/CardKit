
define('cardkit', [
    'mo/lang',
    'dollar',
    'mo/browsers',
    'mo/mainloop',
    'cardkit/spec',
    'cardkit/oldspec',
    'cardkit/ui',
    'cardkit/supports',
    'cardkit/bus'
], function(_, $, browsers, mainloop,
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
        this._specs = this._config.oldStyle ? oldspecs : specs;
        this.initSpec();
        this.initView();
    },

    initSpec: function(){
        _.each(specs, function(data, name){
            var spec = this._specs[name][0];
            this.component(name, data[1][name]());
            this.spec(name, spec);
        }, this);
    },

    initView: function(){
        this.wrapper = $(this._config.appWrapper || body);
        if (browsers.webview) {
            this.wrapper.addClass('ck-in-webview');
        }
        bus.on('ready', function(){
            $(window).on('hashchange', function(e){
                e.preventDefault();
                exports.openPage();
            });
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

    scrollPageTo: function(pid){
        var target = $('.ck-page-card #' + pid);
        if (target[0]) {
            mainloop.addTween('scrollPage', 
                    window.scrollY, target.offset().top, 400, { 
                easing: 'ease',
                step: function(v){
                    window.scrollTo(0, v);
                },
                callback: function(){
                    mainloop.pause();
                }
            }).run('scrollPage');
        }
    },

    openPageByNode: function(node){
        var spec = this._specs['page'][0];
        var outer_page = node.closest(spec.SELECTOR);
        if (!outer_page[0]) {
            outer_page = node.closest(spec.SELECTOR_OLD);
        }
        if (outer_page[0]) {
            this.openPage(outer_page);
        }
        return outer_page;
    },

    openPage: function(page){
        if (_page_opening) {
            return false;
        }
        page = this.findPage(page);
        var pid = page[1];
        page = page[0];
        var is_page = this.isPage(page);
        if (pid && page[0] && !is_page) {
            this.openPageByNode(page);
            setTimeout(function(){
                this.scrollPageTo(pid);
            }.bind(this), 400);
            return true;
        }
        var last_decktop = _decks[DEFAULT_DECK];
        var is_init = !last_decktop;
        if (!page[0] || !is_page) {
            if (!is_init) {
                return false;
            }
            location.replace('#' + this._config.defaultPage);
            page = $('#' + this._config.defaultPage);
        }
        window.scrollTo(0, 0);
        if (is_init) {
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
        if (is_init) {
            page.once('pageCard:opened', function(){
                bus.resolve('ready');
            });
        }
        open_page(page);
        focus_page(page);
        _page_opening = false;
        return true;
    },

    resetPage: function(page){
        page = this.findPage(page)[0];
        if (!page[0]) {
            return;
        }
        page.resetDarkDOM();
    },

    findPage: function(page){
        var pid;
        if (!page || typeof page === 'string') {
            var hash = RE_HASH.exec(location.href);
            pid = page 
                || hash && hash[1] 
                || this._config.defaultPage;
            page = $('#' + pid);
        } else {
            page = $(page);
        }
        return [page, pid];
    },

    isPage: function(page){
        var spec = this._specs['page'][0];
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
