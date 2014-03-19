define([
    'moui/ranger',
    '../bus',
    './growl',
    './util'
], function(ranger, bus, growl, util){

return util.singleton({

    flag: '_ckRangerUid',

    customOptions: {
        enableNotify: true
    },

    factory: function(elm, opt){
        return ranger(elm, opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.notify = o._config.enableNotify ? growl({
            parent: source.parent(),
            corner: 'stick'
        }) : null;
        o.event.bind('change', function(v){
            if (o.notify) {
                o.notify.set({
                    content: v
                }).open();
            }
        }).bind('changed', function(){
            var url = source.trigger('ranger:changed', {
                component: o
            }).data('url');
            bus.fire('ranger:changed', [o, url]);
        }).bind('changeEnd', function(){
            if (o.notify) {
                o.notify.close();
            }
        });
    }

});

});
