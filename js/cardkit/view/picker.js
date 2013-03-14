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
                dataType: cfg.jsonUrl ? 'json' : 'text',
                success: fn
            });
        } else {
            fn();
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

        p.event.bind('change', function(p){
            elm.trigger('picker:change', {
                component: p 
            });
        }).bind('select', function(p, controller){
            var cfg = controller._config;
            p.showLoading();
            request({
                url: cfg.enableUrl,
                jsonUrl: cfg.enableJsonUrl
            }, function(data){
                p.hideLoading();
                p.responseData = data;
                elm.trigger('picker:response', {
                    component: p 
                });
            });
        }).bind('unselect', function(p, controller){
            var cfg = controller._config;
            p.showLoading();
            request({
                url: cfg.disableUrl,
                jsonUrl: cfg.disableJsonUrl
            }, function(data){
                p.hideLoading();
                p.responseData = data;
                elm.trigger('picker:response', {
                    component: p 
                });
            });
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
