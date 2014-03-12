
define([
    'dollar',
    '../helper',
    './common/scaffold'
], function($, helper, scaffold_specs){ 

var source_states = {
        source: helper.readSource
    },
    SEL = '.ckd-box-card',
    SEL_OLD = '.ck-box-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    guard.state({
        subtype: 'data-style',
        paperStyle: 'data-cfg-paper',
        plainStyle: 'data-cfg-plain',
        plainHdStyle: 'data-cfg-plainhd'
    });
    guard.component(scaffold_specs);
    guard.component('content', function(guard){
        guard.watch('.ckd-content');
        guard.state(source_states);
    });
    guard.source().component(scaffold_specs);
    guard.source().component('content', '.ckd-content');
};

});
