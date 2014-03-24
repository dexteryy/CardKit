
define(function(require){ 

var $ = require('dollar'),
    newspec = require('../spec/page'),
    helper = require('../helper'),
    action_attr = newspec.initOldStyleActionState,
    UNMOUNT_FLAG = '.unmount-page';

var specs = {
    title: title_spec,
    actionbar: actionbar_spec,
    nav: nav_spec,
    banner: banner_spec,
    footer: footer_spec,
    blank: blank_spec,
    box: require('./box'),
    list: require('./list'),
    mini: require('./mini'),
    form: require('./form'),
};

function title_spec(guard){
    guard.watch('.ckd-page-title');
    guard.state('source', helper.readSource);
}

function blank_spec(guard){
    guard.watch('.ckd-page-blank');
    guard.state('source', helper.readSource);
}

function nav_spec(guard){
    guard.watch('.ckd-page-nav');
    guard.state({
        link: 'href',
        source: helper.readSource 
    });
}

function banner_spec(guard){
    guard.watch('.ckd-page-banner');
    guard.watch('.ck-banner-unit'); // @deprecated
    guard.state({
        plainStyle: 'data-cfg-plain',
        source: helper.readSource 
    });
}

function actionbar_spec(guard){
    guard.watch('.ckd-page-actions');
    guard.state({
        limit: 'data-cfg-limit',
        source: helper.readSource 
    });
    guard.component('action', action_spec);
    guard.source().component('action', action_spec);
    helper.applyActionEvents(guard);
}

function footer_spec(guard){
    guard.watch('.ckd-page-footer');
    guard.state('source', helper.readSource);
}

function action_spec(guard){
    guard.watch('.ckd-item, .ckd-overflow-item');
    guard.state('source', helper.readSource);
    action_attr(guard);
    action_attr(guard.source());
}

function exports(guard, parent){
    guard.watch($(exports.SELECTOR + UNMOUNT_FLAG, parent));
    guard.watch($(exports.SELECTOR_OLD + UNMOUNT_FLAG, parent));
    guard.state({
        blankText: 'data-cfg-blank',
        deck: 'data-cfg-deck',
        isPageActive: 'data-active-page',
        isDeckActive: 'data-active-deck',
        currentDeck: 'data-current-deck',
        cardId: 'id'
    });
    guard.component(specs);
    helper.applyStateEvents(guard);
}

exports.SELECTOR = '.ckd-page-card';
exports.SELECTOR_OLD = '.ck-card'; // @deprecated

return exports;

});

