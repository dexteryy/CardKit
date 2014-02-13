
define([
    'dollar',
    '../helper',
    '../spec/form',
    './common/scaffold'
], function($, helper, form_spec, scaffold_specs){ 

var source_states = {
        source: helper.readSource
    },
    source_item_spec = form_spec.sourceItemSpec,
    SEL = '.ckd-form-card',
    SEL_OLD = '.ck-form-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    guard.state({
        subtype: 'data-style',
        blankText: 'data-cfg-blank',
        plainHdStyle: 'data-cfg-plainhd'
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('.ckd-item');
        guard.component('content', function(guard){
            guard.watch('.ckd-content');
            guard.state(source_states);
        });
        guard.source().component('content', '.ckd-content');
    });
    helper.applyUserEvents(guard);
    guard.source().component(scaffold_specs);
    guard.source().component('item', source_item_spec);
};

});

