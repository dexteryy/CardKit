define([
    'dollar',
    'moui/ranger',
    './growl'
], function($, ranger, growl){

    var UID = '_ckRangerUid',
    
        notify,
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
        if (!notify) {
            notify = growl({});
        }
        p.notify = notify;
        p.event.bind('change', function(v){
            p.notify.set({
                content: v
            }).open();
        });

        return p;
    }

    return exports;

});
