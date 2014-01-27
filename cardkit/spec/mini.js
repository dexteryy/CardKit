
define([
    'dollar',
    './list'
], function($, list_spec){ 

var SEL = 'ck-card[type="mini"]';

return function(guard, parent){
    guard.watch($(SEL, parent));
    list_spec.initList(guard);
};

});

