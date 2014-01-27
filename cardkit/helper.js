
define([
    'mo/lang',
    'dollar'
], function(_, $){

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

    isBlank: function(content){
        return !content || !/\S/m.test(content);
    }

};

return exports;

});
