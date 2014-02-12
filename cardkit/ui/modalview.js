define([
    'mo/lang',
    'dollar',
    'mo/network',
    'moui/modalview'
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
                : '<ck-card type="page" ' 
                    + 'data-cfg-deck="modalview" '
                    + 'id="ckPageOld-' + this.id + '">'
                    + this.id + '" class="ck-modal-page">';
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
