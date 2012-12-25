define('moui/overlay', [
    'dollar',
    'mo/lang',
    'mo/template',
    'eventmaster'
], function($, _, tpl, Event) {

    var body = $('body'),

        NS = 'mouiOverlay',
        TPL_VIEW =
           '<div id="{{id}}" class="moui-overlay">\
                <header><h2></h2></header>\
                <div class="moui-overlay-content"></div>\
            </div>',
        LOADING_DOTS = '<span class="loading"><i>.</i><i>.</i><i>.</i></span>',
        LOADING_DEFAULT = '加载中',

        _mid = 0,

        default_config = {
            title: '',
            content: '',
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
            this.event = Event();
            this._config = _.mix({}, this._defaults, opt);
            body.append(tpl.format(this._template, { 
                id: this.id 
            }));
            this._node = $('#' + this.id);
            this._header = this._node.find('header').eq(0);
            this._title = this._header.find('h1');
            this._content = this._node.find('.moui-overlay-content');
        },

        set: function(opt) {

            var self = this;
            this._config = _.mix(this._config, opt);

            if (typeof opt.title === 'string') {
                this.setTitle(opt.title);
            }

            if (opt.content !== undefined) {
                this.setContent(opt.content);
            }

            return this;

        },

        setTitle: function(text){
            this._title.html(text);
        },

        setContent: function(html){
            this._content.html(html);
        },

        showLoading: function(text) {
            this._title.html((text || LOADING_DEFAULT) + LOADING_DOTS);
            return this;
        },

        hideLoading: function(){
            this._title.html(this._config.title);
        },

        open: function() {
            if (this.opened) {
                return;
            }
            this.opened = true;
            this._node.appendTo(body).addClass('active');
            this.event.fire('open', [this]);
            return this;
        },

        close: function() {
            if (!this.opened) {
                return;
            }
            this.opened = false;
            this.event.fire('close', [this]);
            this._node.removeClass('active');
            return this;
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
