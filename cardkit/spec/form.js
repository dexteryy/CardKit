
define([
    'dollar',
    '../helper',
    './common/scaffold',
    './common/source_scaffold'
], function($, helper, scaffold_specs, source_scaffold_specs){ 

var SEL = 'ck-card[type="form"]';

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
        guard.component({
            title: 'ck-part[type="title"]',
            content: 'ck-part[type="content"]'
        });
        helper.applyInputEvents(guard);
        guard.source().component('content', '.ckd-content');
    });
    guard.source().component(source_scaffold_specs);
    guard.source().component('item', exports.sourceItemSpec);
}

exports.sourceItemSpec = function(guard){
    guard.watch('.ckd-item');
    guard.component({
        title: '.ckd-title',
        content: '.ckd-content'
    });
};

return exports;

});

