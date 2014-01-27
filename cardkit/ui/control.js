define([
    'mo/lang',
    'moui/control',
    './util'
], function(_, control, util) {

var default_config = {
    disableRequest: false,
    enableUrl: '',
    enableJsonUrl: '',
    enableMethod: 'post',
    disableUrl: '',
    disableJsonUrl: '',
    disableMethod: 'post'
};

var CkControl = _.construct(control.Control);

_.mix(CkControl.prototype, {

    _defaults: _.mix({}, CkControl.prototype._defaults, default_config),

    enable: function(){
        var cfg = this._config;
        return this.request({
            method: cfg.enableMethod,
            url: cfg.enableUrl,
            jsonUrl: cfg.enableJsonUrl
        }, function(){
            this.superClass.enable.call(this);
        });
    },

    disable: function(){
        var cfg = this._config;
        return this.request({
            method: cfg.disableMethod,
            url: cfg.disableUrl,
            jsonUrl: cfg.disableJsonUrl
        }, function(){
            this.superClass.disable.call(this);
        });
    },

    request: function(cfg, fn){
        var self = this;
        var cb = function(data, status){
            if (status === 'success') {
                self.responseData = data;
            }
            self.hideLoading();
            fn.call(self);
        };
        if (!this._config.disableRequest) {
            util.request({
                config: cfg,
                before: function(){
                    self.showLoading();
                },
                callback: cb
            });
        } else {
            cb();
        }
        return this;
    }

});

var exports = util.singleton({

    flag: '_ckControlUid',

    factory: function(elm, opt){
        return new exports.Control(elm, opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.event.bind('enable', function(o){
            source.trigger('control:enable', {
                component: o
            });
        }).bind('disable', function(o){
            source.trigger('control:disable', {
                component: o
            });
        });
    }

});

exports.Control = CkControl;

return exports;

});
