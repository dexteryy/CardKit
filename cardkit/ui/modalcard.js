define([
    'dollar',
    'mo/network',
    'moui/modalview'
], function($, net, modal) {

    var modalCard = modal({
            className: 'ck-modalview',
            closeDelay: 400
        }),
        SCRIPT_TYPES = {
            'text/darkscript': 1,
            'text/cardscript': 1,
            'text/jscode': 1
        },
        _tm,
        _content_filter,
        origin_set_content = modalCard.setContent,
        origin_set = modalCard.set;

    modalCard.set = function(opt){
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

        _content_filter = opt.contentFilter;

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

        return origin_set.call(this, opt);
    };

    modalCard.setContent = function(html){
        if (_content_filter) {
            html = (new RegExp(_content_filter).exec(html) || [])[1];
        }
        return origin_set_content.call(this, html);
    };

    modalCard.event.bind('confirm', function(modal){
        modal.event.fire('confirmOnThis', arguments);
    }).bind('close', function(modal){
        _tm = 0;
        modal.event.unbind('confirmOnThis');
    });

    return modalCard;

});
