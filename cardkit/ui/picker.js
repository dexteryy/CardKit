define([
    'mo/lang',
    'moui/picker',
    './util'
], function(_, picker, util) {

_.mix(picker.Picker.prototype._defaults, {
    disableRequest: false
});

return util.singleton({

    flag: '_ckPickerUid',

    factory: function(elm, opt){
        return picker(elm, opt);
    },

    defaultOptions: {
        options: '.ck-option'
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.event.bind('change', function(o, controller){
            var cfg = controller.data(), 
                eprops = {
                    component: o 
                },
                req_opt;
            if (!o._config.disableRequest) {
                o.showLoading();
                if (controller.isEnabled) {
                    req_opt = {
                        method: cfg.enableMethod,
                        url: cfg.enableUrl,
                        jsonUrl: cfg.enableJsonUrl
                    };
                } else {
                    req_opt = {
                        method: cfg.disableMethod,
                        url: cfg.disableUrl,
                        jsonUrl: cfg.disableJsonUrl
                    };
                }
                util.request({
                    config: req_opt,
                    callback: function(data, status){
                        o.hideLoading();
                        if (status === 'success') {
                            o.responseData = data;
                            source.trigger('picker:response', eprops);
                        }
                    }
                });
            }
            source.trigger('picker:change', eprops);
        });
    }

});

});
