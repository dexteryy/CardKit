
define('momo/drag', [
    'mo/lang',
    'momo/base'
], function(_, momoBase){

    var MomoDrag = _.construct(momoBase.Class);

    function exports(elm, opt, cb){
        return new exports.Class(elm, opt, cb);
    }

    exports.Class = MomoDrag;

    return exports;

});
