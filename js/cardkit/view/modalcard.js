define([
    'dollar',
    'mo/network',
    'moui/modalview',
    '../supports'
], function($, net, modal, supports) {

    var modalCard = modal({
            className: 'ck-modalview',
            closeDelay: 400
        }),
        _content_filter,
        origin_set_content = modalCard.setContent,
        origin_set = modalCard.set;

    modalCard.set = function(opt){
        if (!opt) {
            return this;
        }

        var self = this,
            url = opt.jsonUrl || opt.url;
        if (url) {
            opt.content = '';
            self.showLoading();
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
                if (type === 'text/cardscript' || type === 'text/jscode') {
                    return '<script>' + elm.innerHTML + '</script>';
                } else {
                    return elm.innerHTML;
                }
            }).join('');
        }

        function callback(data){
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
    
    if (supports.BROWSER_CONTROL) {
        modalCard.ok = modalCard.done = function(){
            history.back();
            return this.event.promise('close');
        };
    }

    modalCard.event.bind('confirm', function(modal){
        modal.event.fire('confirmOnThis', arguments);
    }).bind('close', function(modal){
        modal.event.unbind('confirmOnThis');
    });

    return modalCard;

});
