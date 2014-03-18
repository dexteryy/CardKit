define([
    'mo/lang',
    'dollar',
    'moui/modalview'
], function(_, $, originModal) {

var default_config = {
        className: 'ck-modalview',
        openDelay: 400,
        closeDelay: 400,
        oldStylePage: false,
        contentFilter: false
    },
    SCRIPT_TYPES = {
        'text/modalview-javascript': 1,
        'text/cardscript': 1, // @deprecated
        'text/jscode': 1 // @deprecated
    },
    singleton;

var ModalView = _.construct(originModal.ModalView);

_.mix(ModalView.prototype, {

    _defaults: _.mix({}, ModalView.prototype._defaults, default_config),

    init: function() {
        this.superMethod('init', arguments);
        this.event.bind('confirm', function(modal){
            modal.event.fire('confirmOnThis', arguments);
        }).bind('close', function(modal){
            modal.event.unbind('confirmOnThis');
        });
        return this;
    },

    set: function(opt){
        if (!opt) {
            return this;
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

        var re = this.superMethod('set', [opt]);

        if (!this.pageNode()[0]) {
            this._content.append(this.wrapPageContent('<div></div>'));
        }

        return re;
    },

    setContent: function(html){
        if (html) {
            var filter = this._config.contentFilter;
            if (filter) {
                html = (new RegExp(filter).exec(html) || [])[1];
            }
            html = this.wrapPageContent(html);
        }
        return this.superMethod('setContent', [html]);
    },

    pageNode: function(){
        return this._content.find('.ck-modal-page');
    },

    wrapPageContent: function(html){
        var oldstyle = this._config.oldStylePage;
        var page_start = oldstyle 
            ? '<div class="ckd-page-card ck-modal-page" ' 
                + 'data-cfg-deck="modalview" '
                + 'id="ckPage-' + this.id + '">'
            : '<ck-card type="page" class="ck-modal-page" ' 
                + 'deck="modalview" '
                + 'id="ckPageOld-' + this.id + '">';
        var page_end = oldstyle ? '</div>' : '</ck-card>';
        return page_start + html + page_end;
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
