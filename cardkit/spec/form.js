
define([
    'dollar',
    '../helper',
    './common/scaffold',
    './common/source_scaffold'
], function($, helper, scaffold_specs, source_scaffold_specs){ 

var SEL = 'ck-card[type="form"]';

function source_item_spec(guard){
    guard.watch('.ckd-item');
    guard.component('content', '.ckd-content');
}

function exports(guard, parent){
    guard.watch($(SEL, parent));
    guard.state({
        subtype: 'subtype',
        blankText: 'blank-text',
        plainHdStyle: 'plain-hd-style'
    });
    guard.component(scaffold_specs);
    guard.component('item', function(guard){
        guard.watch('ck-part[type="item"]');
        guard.component('content', 'ck-part[type="content"]');
        guard.forward({
            'textarea:change': forward_textchange
        });
        guard.source().component('content', '.ckd-content');
    });
    helper.applyUserEvents(guard);
    guard.source().component(source_scaffold_specs);
    guard.source().component('item', source_item_spec);
}

function forward_textchange(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            node.val(e.target.value);
        }
    }
}

exports.sourceItemSpec = source_item_spec;

return exports;

});

