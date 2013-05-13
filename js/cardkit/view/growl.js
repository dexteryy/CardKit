define([
    'mo/lang',
    'dollar',
    'moui/growl'
], function(_, $, growl) {

    var UID = '_ckGrowlUid',
    
        uid = 0,
        lib = {};

    function exports(elm, opt){
        var id,
            defaults = {
                corner: 'bottom'
            };
        if (elm.nodeName) {
            elm = $(elm);
            id = elm[0][UID];
            if (id && lib[id]) {
                lib[id].close();
            }
            id = elm[0][UID] = ++uid;
            opt = _.mix(defaults, elm.data(), opt);
        } else {
            opt = _.mix(defaults, elm);
        }
        opt.className = 'ck-growl';
        var g = growl(opt);
        if (id) {
            lib[id] = g;
        }
        return g;
    }

    return exports;

});
