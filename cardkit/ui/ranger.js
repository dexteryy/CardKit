define([
    'moui/ranger',
    '../bus',
    './growl',
    './util'
], function(ranger, bus, growl, util){

return util.singleton({

    flag: '_ckRangerUid',

    factory: function(elm, opt){
        return ranger(elm, opt);
    },

    config: function(o, opt){
        o.set(opt);
    },

    extend: function(o, source){
        o.notify = growl({
            parent: source.parent(),
            corner: 'stick'
        });
        o.event.bind('change', function(v){
            o.notify.set({
                content: v
            }).open();
        }).bind('changed', function(){
            var url = source.trigger('ranger:changed', {
                component: o
            }).data('url');
            bus.fire('ranger:changed', [o, url]);
        }).bind('changeEnd', function(){
            o.notify.close();
        });
    }

});

});
