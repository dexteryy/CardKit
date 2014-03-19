define([
    'mo/lang',
    'dollar',
    'mo/network'
], function(_, $, net){

var _default_steps = {
    flag: '_ckViewUid',
    forceOptions: {},
    defaultOptions: {},
    customOptions: {},
    config: function(){},
    extend: function(){}
};

var exports = {

    singleton: function(steps){
        var uid = 0, 
            lib = {};
        steps = _.merge(steps, _default_steps);
        function factory(elm, opt){
            var id = elm;
            if (typeof elm === 'object') {
                elm = $(elm);
                id = elm[0][steps.flag];
            } else {
                elm = false;
            }
            var re = id && lib[id];
            if (re) {
                if (opt) {
                    steps.config(re, opt);
                }
            } else {
                if (elm) {
                    id = elm[0][steps.flag] = ++uid;
                }
                opt = _.merge(_.mix(opt || {}, 
                        factory.forceOptions, steps.forceOptions), 
                    steps.defaultOptions, factory.defaultOptions);
                re = lib[id] = steps.factory(elm, opt);
                _.merge(re._config, 
                    _.merge(_.interset(opt, steps.customOptions), 
                        steps.customOptions));
                steps.extend(re, elm);
            }
            return re;
        }
        factory.forceOptions = {};
        factory.defaultOptions = {};
        factory.gc = function(check){
            for (var i in lib) {
                if (check(lib[i])) {
                    delete lib[i];
                }
            }
        };
        return factory;
    },

    request: function(opt){
        var cfg = opt.config,
            url = cfg.jsonUrl || cfg.url;
        if (url) {
            var data;
            url = url.replace(/\?(.+)$/, function($0, $1) {
                data = $1.replace(/#.*/, '');
                return '';
            });
            net.ajax({
                url: url,
                data: data,
                type: cfg.method || 'post',
                dataType: cfg.jsonUrl ? 'json' : 'text',
                beforeSend: opt.before,
                handleError: opt.callback,
                success: opt.callback
            });
        } else {
            opt.callback();
        }
    }

};

return exports;

});
