define([
    'dollar',
    'moui/picker'
], function($, picker) {

    var UID = '_ckPickerUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        elm = $(elm)[0];
        var id = elm[UID];
        if (id && lib[id]) {
            return lib[id].set(opt);
        }
        id = elm[UID] = ++uid;
        return lib[id] = picker(elm, opt);
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
