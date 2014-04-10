
define([
    'dollar',
    '../helper',
    '../spec/list',
    './common/scaffold',
    './common/item'
], function($, helper, list_spec, scaffold_specs, item_specs){ 

var source_states = {
        source: helper.readSource
    },
    source_item_states = list_spec.sourceItemStates,
    source_item_spec = list_spec.sourceItemSpec,
    SEL = '.ckd-list-card',
    SEL_OLD = '.ck-list-unit'; // @deprecated

function init_list(guard){
    guard.state({
        subtype: 'data-style',
        blankText: 'data-cfg-blank',
        limit: 'data-cfg-limit', 
        col: 'data-cfg-col', 
        paperStyle: 'data-cfg-paper',
        plainStyle: 'data-cfg-plain',
        plainHdStyle: 'data-cfg-plainhd',
        customClass: helper.readClass
    });
    guard.state(source_states);
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('.ckd-item');
        guard.state(source_states);
        guard.state(source_item_states);
        guard.component(item_specs);
        guard.source().component(item_specs);
    });
    guard.source()
        .component(scaffold_specs)
        .component('item', source_item_spec);
}

function exports(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    init_list(guard);
}

exports.initList = init_list;

return exports;

});

