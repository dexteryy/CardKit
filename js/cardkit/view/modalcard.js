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
            net.ajax({
                url: url,
                dataType: opt.jsonUrl ? 'json' : 'text',
                success: function(data){
                    if (opt.jsonUrl) {
                        data = data.html;
                    }
                    self.setContent(data);
                    self.hideLoading();
                }
            });
        }

        if (opt.iframeUrl) {
            opt.iframe = opt.iframeUrl;
        }

        if (opt.source) {
            opt.content = $('.' + opt.source).map(function(elm){
                if ($(elm).attr('type') === 'text/jscode') {
                    return '<script>' + elm.innerHTML + '</script>';
                } else {
                    return elm.innerHTML;
                }
            }).join('');
        }

        return origin_set.call(this, opt);
    };
    
    if (supports.HISTORY) {
        modalCard.ok = modalCard.done = function(){
            if (!history.state) {
                history.go(-2);
            } else {
                history.back();
            }
            return this.event.promise('close');
        };
    } else {
        modalCard.ok = modalCard.done = function(){
            this.event.fire('needclose');
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
