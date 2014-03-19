
define([
    'mo/lang',
    'dollar',
    'darkdom',
    './ui'
], function(_, $, darkdom, ui){

var control = ui.component.control,
    picker = ui.component.picker,
    ranger = ui.component.ranger;

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
            'picker:change *': 'picker:change',
            'picker:response *': 'picker:response',
            'selector:change *': 'selector:change',
            'ranger:changed *': 'ranger:changed'
        });
    },

    applyStateEvents: function(guard){
        guard.forward({
            'control:enable': apply_enable,
            'control:disable': apply_disable,
            'picker:change': apply_pick,
            'picker:response': apply_pick_response,
            'selector:change': apply_selector,
            'ranger:changed': apply_ranger
        });
    },

    forwardActionEvents: function(component){
        component.forward({
            'control:enable .ck-top-act > *': 'topControl:enable',
            'control:disable .ck-top-act > *': 'topControl:disable',
            'actionView:confirm .ck-top-overflow': 'topOverflow:confirm'
        });
    },

    applyActionEvents: function(guard){
        guard.forward({
            'topOverflow:confirm': apply_top_confirm,
            'topControl:enable': apply_top_enable,
            'topControl:disable': apply_top_disable
        });
    },

    forwardInputEvents: function(component){
        component.forward({
            'change select': 'select:change',
            'change input': 'input:change',
            'change textarea': 'input:change'
        });
    },

    applyInputEvents: function(guard){
        guard.forward({
            'select:change': apply_select,
            'input:change': apply_input
        });
    },

    getOriginByCustomId: function(custom_id){
        var re;
        _.each($('body #' + custom_id), function(node){
            if (!$.matches(node, '[dd-autogen] #' + custom_id)) {
                re = $(node);
                return false;
            }
        });
        return re || $();
    },

    isBlank: function(content){
        return !content || !/\S/m.test(content);
    }

};

var apply_enable = find_dark(enable_control);

var apply_disable = find_dark(disable_control);

var apply_pick = find_dark(function(node, e){
    var p = picker(node, {
        disableRequest: true
    });
    var new_val = e.component.val();
    ui.action.updatePicker(p, new_val);
});

var apply_pick_response = find_dark(function(node, e){
    var p = picker(node);
    p.responseData = e.component.responseData;
    node.trigger('picker:response', {
        component: p
    });
});

var apply_selector = find_dark(function(node){
    node.trigger('selector:change', {
        component: picker(node, {
            disableRequest: true
        })
    });
});

var apply_ranger = find_dark(function(node, e){
    var o = ranger(node, {
        enableNotify: false
    });
    var v = e.component.val();
    o.val(v).attr('value', v);
    node.trigger('ranger:changed', {
        component: o
    });
});

var apply_top_enable = find_top_dark(enable_control);

var apply_top_disable = find_top_dark(disable_control);

var apply_top_confirm = function (e){
    var aid = e.component.val();
    var target = $('#' + aid).children();
    target.trigger('tap');
};

var apply_select = find_dark(function(node, e){
    $('option', e.target).forEach(function(option, i){
        if (option.selected) {
            this.eq(i).attr('selected', 'selected');
        } else {
            this.eq(i).removeAttr('selected');
        }
    }, node.find('option'));
});

var apply_input = find_dark(function(node, e){
    var checked = e.target.checked;
    node[0].checked = checked;
    if (checked === false) {
        node.removeAttr('checked');
    } else {
        node.attr('checked', 'checked');
    }
    var value = e.target.value;
    node.val(value).attr('value', value);
});

function enable_control(node, e){
    var o = control(node, {
        disableRequest: true
    });
    o.responseData = e.component.responseData;
    o.enable();
}

function disable_control(node, e){
    var o = control(node, {
        disableRequest: true
    });
    o.responseData = e.component.responseData;
    o.disable();
}

function find_dark(fn){
    return function(e){
        var target = e.target.id;
        if (!target) {
            return;
        }
        target = exports.getOriginByCustomId(target);
        if (target[0] 
                && !target[0]._ckDisablePageForward) {
            fn(target, e);
        }
    };
}

function find_top_dark(fn){
    return function(e){
        var target = e.target.id;
        if (target) {
            target = exports.getOriginByCustomId(target);
        } else {
            target = darkdom.getDarkById(e.target.parentNode.id);
        }
        if (!target[0]) {
            return;
        }
        target[0]._ckDisablePageForward = true;
        fn(target, e);
        if (target[0].isDarkSource) {
            var actionbar = $(e.target).closest('.ck-top-actions');
            darkdom.getDarkById(actionbar[0].id).updateDarkSource();
        } else {
            target.updateDarkDOM();
        }
    };
}

return exports;

});
