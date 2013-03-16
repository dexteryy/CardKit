define([
    'mo/lang',
    'dollar',
    'mo/network',
    'moui/picker'
], function(_, $, net, picker) {

    var UID = '_ckPickerUid',
    
        uid = 0,
        lib = {};

    function request(cfg, fn){
        var url = cfg.jsonUrl || cfg.url;
        if (url) {
            net.ajax({
                url: url,
                type: cfg.method || 'post',
                dataType: cfg.jsonUrl ? 'json' : 'text',
                success: fn
            });
        } else {
            fn(false);
        }
    }

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        var p = lib[id] = picker(elm, opt);

        p.event.bind('change', function(p, controller){
            var cfg = p.data(), 
                eprops = {
                    component: p 
                },
                req_opt;
            p.showLoading();
            if (controller.isEnabled) {
                req_opt = {
                    method: cfg.requestMethod,
                    url: cfg.enableUrl,
                    jsonUrl: cfg.enableJsonUrl
                };
            } else {
                req_opt = {
                    method: cfg.requestMethod,
                    url: cfg.disableUrl,
                    jsonUrl: cfg.disableJsonUrl
                };
            }
            request(req_opt, function(data){
                p.hideLoading();
                if (data !== false) {
                    p.responseData = data;
                    elm.trigger('picker:response', eprops);
                }
            });
            elm.trigger('picker:change', eprops);
        });

        return p;
    }

    exports.gc = function(check){
        for (var i in lib) {
            if (check(lib[i])) {
                delete lib[i];
            }
        }
    };

    return exports;

});
