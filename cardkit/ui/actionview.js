define([
    'moui/actionview',
    '../bus',
    './util'
], function(actionView, bus, util) {

var exports = util.singleton({

    flag: '_ckActionViewUid',

    forceOptions: {
        className: 'ck-actionview'
    },

    factory: function(elm, opt){
        return actionView(opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        var eprops = {
            component: o
        };
        o.event.bind('prepareOpen', function(o){
            exports.current = o;
        }).bind('cancelOpen', function(){
            exports.current = null;
        }).bind('open', function(o){
            bus.fire('actionView:open', [o]);
            if (source) {
                source.trigger('actionView:open', eprops);
            }
        }).bind('close', function(){
            exports.current = null;
            bus.unbind('actionView:confirmOnThis');
            bus.fire('actionView:close', [o]);
            if (source) {
                source.trigger('actionView:close', eprops);
            }
        }).bind('cancel', function(){
            bus.fire('actionView:cancel', [o]);
            if (source) {
                source.trigger('actionView:cancel', eprops);
            }
        }).bind('confirm', function(o, picker){
            bus.fire('actionView:confirmOnThis', [o])
                .fire('actionView:confirm', [o]);
            if (source) {
                source.trigger('actionView:confirm', eprops);
            }
            if (picker && picker._lastSelected) {
                var elm = picker._lastSelected._node[0];
                if (elm.nodeName === 'A') {
                    bus.fire('actionView:jump', [o, elm.href, elm.target]);
                }
            }
        });
    }

});

return exports;

});
