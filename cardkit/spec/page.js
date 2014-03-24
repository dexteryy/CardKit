
define(function(require){ 

var $ = require('dollar'),
    helper = require('../helper'),
    UNMOUNT_FLAG = '.unmount-page';

var specs = {
    title: 'ck-part[type="title"]',
    actionbar: actionbar_spec,
    nav: nav_spec,
    banner: banner_spec,
    footer: 'ck-part[type="footer"]',
    blank: 'ck-part[type="blank"]',
    box: require('./box'),
    list: require('./list'),
    mini: require('./mini'),
    form: require('./form'),
};

function nav_spec(guard){
    guard.watch('ck-part[type="nav"]');
    guard.state({
        link: 'href'
    });
}

function banner_spec(guard){
    guard.watch('ck-part[type="banner"]');
    guard.state({
        plainStyle: 'plain-style'
    });
}

function actionbar_spec(guard){
    guard.watch('ck-part[type="actionbar"]');
    guard.state({
        limit: 'limit'
    });
    guard.component('action', action_spec);
    guard.source().component('action', source_action_spec);
}

function action_spec(guard){
    guard.watch('[action-layout]');
    guard.state({
        label: helper.readLabel,
        forceOverflow: function(node){
            return 'overflow' === 
                node.attr('action-layout');
        }
    });
    source_action_attr(guard.source());
    helper.applyActionEvents(guard);
}

function source_action_spec(source){
    source.watch('.ckd-item, .ckd-overflow-item');
    source_action_attr(source);
}

function source_action_attr(source){
    if (!source) {
        return;
    }
    source.state({
        label: helper.readLabel,
        forceOverflow: function(node){
            return node.hasClass('ckd-overflow-item');
        }
    });
}

function exports(guard, parent){
    guard.watch($(exports.SELECTOR + UNMOUNT_FLAG, parent));
    guard.state({
        blankText: 'blank-text',
        deck: 'deck',
        isPageActive: 'active-page',
        isDeckActive: 'active-deck',
        currentDeck: 'current-deck',
        cardId: 'id'
    });
    guard.component(specs);
    helper.applyStateEvents(guard);
}

exports.SELECTOR = 'ck-card[type="page"]';

exports.initOldStyleActionState = source_action_attr;

return exports;

});

