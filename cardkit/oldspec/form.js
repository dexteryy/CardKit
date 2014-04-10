
define([
    'dollar',
    '../helper',
    '../spec/form',
    './common/scaffold'
], function($, helper, form_spec, scaffold_specs){ 

var source_states = {
        source: helper.readSource
    },
    SEL = '.ckd-form-card',
    SEL_OLD = '.ck-form-unit'; // @deprecated

return function(guard, parent){
    guard.watch($(SEL, parent));
    guard.watch($(SEL_OLD, parent));
    guard.state({
        subtype: 'data-style',
        blankText: 'data-cfg-blank',
        plainHdStyle: 'data-cfg-plainhd',
        customClass: helper.readClass
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('.ckd-item');
        guard.component({
            title: function(guard){
                guard.watch('.ckd-title');
                guard.state(source_states);
            },
            content: function(guard){
                guard.watch('.ckd-content');
                guard.state(source_states);
            }
        });
        helper.applyInputEvents(guard);
        guard.source().component({
            title: '.ckd-title',
            content: '.ckd-content'
        });
    });
    guard.source()
        .component(scaffold_specs)
        .component('item', form_spec.sourceItemSpec);
};

});

