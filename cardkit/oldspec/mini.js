
define([
    'dollar',
    './list'
], function($, list_spec){ 

var SEL = '.ckd-mini-card',
    SEL_OLD = '.ck-mini-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    list_spec.initList(guard);
};

});

