
define(function(require){ 

var $ = require('dollar'),
    darkdom = require('darkdom'),
    helper = require('../helper'),
    UNMOUNT_FLAG = '.unmount-page';

var specs = {
    title: 'ck-part[type="title"]',
    actionbar: actionbar_spec,
    nav: nav_spec,
    banner: banner_spec,
    footer: 'ck-part[type="footer"]',
    blank: blank_spec,
    box: require('./box'),
    list: require('./list'),
    mini: require('./mini'),
    form: require('./form'),
};

function blank_spec(guard){
    guard.watch('ck-part[type="blank"]');
}

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
    exports.forwardActionbar(guard);
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

function forward_control(e){
    var target = darkdom.getDarkById(e.target.parentNode.id);
    if (target) {
        target.trigger('tap').updateDarkDOM();
    }
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
}

exports.SELECTOR = 'ck-card[type="page"]';

exports.initOldStyleActionState = source_action_attr;

exports.forwardActionbar = function(guard){
    guard.forward({
        'overflows:confirm': function(e){
            var aid = e.component.val();
            var target = $('#' + aid).children();
            target.trigger('tap');
        },
        'control:enable': forward_control,
        'control:disable': forward_control
    });
};

return exports;

});

