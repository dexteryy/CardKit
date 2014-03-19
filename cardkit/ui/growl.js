define([
    'mo/lang',
    'dollar',
    'moui/growl'
], function(_, $, growl) {

var FLAG = '_ckGrowlUid',
    uid = 0,
    lib = {};

function exports(elm, opt){
    var id;
    var defaults = {
        corner: 'bottom'
    };
    if (elm.nodeName) {
        elm = $(elm);
        id = elm[0][FLAG];
        if (id && lib[id]) {
            lib[id].close();
        }
        id = elm[0][FLAG] = ++uid;
        opt = _.mix(defaults, elm.data(), opt);
    } else {
        opt = _.mix(defaults, elm);
    }
    opt.className = 'ck-growl';
    _.merge(opt, exports.defaultOptions);
    var g = growl(opt);
    if (id) {
        lib[id] = g;
    }
    return g;
}

exports.defaultOptions = {};

return exports;

});
