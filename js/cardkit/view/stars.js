define([
    'mo/lang',
    'dollar',
    'mo/network',
    'moui/slider'
], function(_, $, net, slider) {
    var UID = '_ckStarsUid',
        uid = 0,
        lib = {};

    function exports(elm) {
        elm = $(elm);
        var id = elm[0][UID];
        if (id && lib[id]) {
            return lib[id];
        }
        id = elm[0][UID] = ++uid;
        var s = lib[id] = slider(elm);

        s.event.bind('change', function() {
            var value = s.val();
            s.show(value);
        });

        return s;
    }

    exports.gc = function(check) {
        for (var i in lib) {
            if (check(lib[i])) {
                delete lib[i];
            }
        }
    };

    return exports;
});
