define([
    'dollar',
    'moui/ranger',
    '../bus',
    './growl'
], function($, ranger, bus, growl){

    var UID = '_ckRangerUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        opt = opt || {};
        var p = lib[id] = ranger(elm, opt);
        p.notify = growl({
            parent: elm.parent(),
            corner: 'stick'
        });
        p.event.bind('change', function(v){
            p.notify.set({
                content: v
            }).open();
        }).bind('changed', function(){
            var url = elm.trigger('ranger:changed', {
                component: p
            }).data('url');
            bus.fire('ranger:changed', [p, url]);
        }).bind('changeEnd', function(){
            p.notify.close();
        });

        return p;
    }

    return exports;

});
