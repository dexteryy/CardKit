define([
    'mo/lang',
    'dollar',
    'mo/network',
    'moui/control'
], function(_, $, net, control) {

    var UID = '_ckControlUid',
    
        uid = 0,
        lib = {};

    var CkControl = _.construct(control.Control);

    _.mix(CkControl.prototype, {

        enable: function(){
            var cfg = this.data();
            return this.request({
                method: cfg.requestMethod,
                url: cfg.enableUrl,
                jsonUrl: cfg.enableJsonUrl
            }, function(){
                this.superClass.enable.call(this);
            });
        },

        disable: function(){
            var cfg = this.data();
            return this.request({
                method: cfg.requestMethod,
                url: cfg.disableUrl,
                jsonUrl: cfg.disableJsonUrl
            }, function(){
                this.superClass.disable.call(this);
            });
        },

        request: function(cfg, fn){
            var self = this,
                url = cfg.jsonUrl || cfg.url;
            if (url) {
                self.showLoading();
                net.ajax({
                    url: url,
                    type: cfg.method || 'post',
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
    
    });

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        var controller = lib[id] = new exports.Control(elm, opt);
        controller.event.bind('enable', function(controller){
            elm.trigger('control:enable', {
                component: controller
            });
        }).bind('disable', function(controller){
            elm.trigger('control:disable', {
                component: controller
            });
        });
        return controller;
    }

    exports.Control = CkControl;

    exports.gc = function(check){
        for (var i in lib) {
            if (check(lib[i])) {
                delete lib[i];
            }
        }
    };

    return exports;

});
