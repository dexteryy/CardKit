
define([
    'mo/lang',
    'dollar',
    'darkdom',
    './ui'
], function(_, $, darkdom, ui){

var control = ui.component.control,
    picker = ui.component.picker;

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

    forwardStateEvents: function(component){
        component.forward({
            'control:enable *': 'control:enable',
            'control:disable *': 'control:disable',
            'picker:change *': 'picker:change'
        });
    },

    applyStateEvents: function(guard){
        guard.forward({
            'control:enable': apply_enable,
            'control:disable': apply_disable,
            'picker:change': apply_pick
        });
    },

    forwardActionEvents: function(component){
        component.forward({
            'control:enable .ck-top-act > *': 'control:enable',
            'control:disable .ck-top-act > *': 'control:disable',
            'actionView:confirm .ck-top-overflow': 'overflows:confirm'
        });
    },

    applyActionEvents: function(guard){
        guard.forward({
            'overflows:confirm': apply_top_confirm,
            'control:enable': apply_top_enable,
            'control:disable': apply_top_disable
        });
    },

    forwardInputEvents: function(component){
        component.forward({
            'change input': 'input:change',
            'change textarea': 'input:change'
        });
    },

    applyInputEvents: function(guard){
        guard.forward({
            'input:change': forward_input 
        });
    },

    isBlank: function(content){
        return !content || !/\S/m.test(content);
    }

};

var apply_enable = find_dark(function(node){
    control(node, {
        disableRequest: true
    }).enable();
});

var apply_disable = find_dark(function(node){
    control(node, {
        disableRequest: true
    }).disable();
});

var apply_pick = find_dark(function(node, e){
    picker(node, {
        disableRequest: true
    }).select(e.component.val());
});

var apply_top_enable = find_top_dark(function(node){
    control(node, {
        disableRequest: true
    }).enable();
});

var apply_top_disable = find_top_dark(function(node){
    control(node, {
        disableRequest: true
    }).disable();
});

var apply_top_confirm = function (e){
    var aid = e.component.val();
    var target = $('#' + aid).children();
    target.trigger('tap');
};

var forward_input = find_dark(function(node, e){
    node.val(e.target.value);
});

function find_dark(fn){
    return function(e){
        var node = e.target.id;
        if (node) {
            node = $('#' + node);
            if (node[0]) {
                fn(node, e);
            }
        }
    };
}

function find_top_dark(fn){
    return function(e){
        if (e.target.id) {
            return;
        }
        var target = darkdom.getDarkById(e.target.parentNode.id);
        if (target) {
            fn(target, e);
        }
    };
}

return exports;

});
