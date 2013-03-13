define([
    'dollar',
    'moui/picker'
], function($, picker) {

    var UID = '_ckPickerUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[0][UID] = ++uid;
        var p = lib[id] = picker(elm, opt);
        p.event.bind('enable', function(p){
            elm.trigger('picker:enable', {
                component: p 
            });
        }).bind('disable', function(p){
            elm.trigger('picker:disable', {
                component: p
            });
        });
        return p;
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
