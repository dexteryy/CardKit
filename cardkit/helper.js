
define([
    'mo/lang',
    'dollar',
    './ui'
], function(_, $, ui){

var exports = {

    readState: function(data, state){
        return data && (data.state || {})[state];
    },

    readSource: function(node){
        var source = node.data('source');
        return source && ('.' + source);
    },

    readLabel: function(node){
        var label = node.data('label');
        if (label) {
            label = node.find(label)[0];
        }
        label = $(label || node);
        return label.text() || label.val();
    },

    forwardUserEvents: function(component){
        component.forward({
            'control:enable *': 'control:enable',
            'control:disable *': 'control:disable',
            'picker:change *': 'picker:change'
        });
    },

    applyUserEvents: function(guard){
        guard.forward({
            'control:enable': forward_enable,
            'control:disable': forward_disable,
            'picker:change': forward_pick
        });
    },

    isBlank: function(content){
        return !content || !/\S/m.test(content);
    }

};

function forward_enable(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            ui.component.control(node, {
                disableRequest: true
            }).enable();
        }
    }
}

function forward_disable(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            ui.component.control(node, {
                disableRequest: true
            }).disable();
        }
    }
}

function forward_pick(e){
    var node = e.target.id;
    if (node) {
        node = $('#' + node);
        if (node[0]) {
            ui.component.picker(node, {
                disableRequest: true
            }).select(e.component.val());
        }
    }
}

return exports;

});
