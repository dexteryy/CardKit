define([
    'mo/lang',
    'dollar',
    'mo/network',
    'moui/control'
], function(_, $, net, control) {

    var UID = '_ckControlUid',
    
        uid = 0,
        lib = {};

    var ext = {

        toggle: function(){
            if (this.isEnabled) {
                this.toDisable();
            } else {
                this.toEnable();
            }
            return this;
        },

        toEnable: function(){
            var cfg = this.data();
            return this.request({
                url: cfg.enableUrl,
                jsonUrl: cfg.enableJsonUrl
            }, function(){
                this.enable();
            });
        },

        toDisable: function(){
            var cfg = this.data();
            return this.request({
                url: cfg.disableUrl,
                jsonUrl: cfg.disableJsonUrl
            }, function(){
                this.disable();
            });
        },

        request: function(cfg, fn){
            var self = this,
                url = cfg.jsonUrl || cfg.url;
            if (url) {
                self.showLoading();
                net.ajax({
                    url: url,
                    dataType: cfg.jsonUrl ? 'json' : 'text',
                    success: function(data){
                        self.hideLoading();
                        self.responseData = data;
                        fn.call(self);
                    }
                });
            } else {
                fn.call(self);
            }
            return this;
        }
    
    };

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        var controller = lib[id] = control(elm, opt);
        controller.event.bind('enable', function(controller){
            elm.trigger('control:enable', {
                component: controller
            });
        }).bind('disable', function(controller){
            elm.trigger('control:disable', {
                component: controller
            });
        });
        return _.mix(controller, ext);
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
