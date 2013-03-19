define([
    'dollar',
    'mo/network',
    'moui/modalview'
], function($, net, modal) {

    var modalCard = modal({
            className: 'ck-modalview'
        }),
        origin_set = modalCard.set;

    modalCard.set = function(opt){
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
    
    modalCard.done = function(){
        if (!history.state) {
            history.go(-2);
        } else {
            history.back();
        }
        return this;
    };

    return modalCard;

});
