
define([
    'dollar',
    'mo/lang'
], function($, _){

    var exports = {

        getSource: function(node, raw){
            var sid = $(node).data('source');
            if (sid) {
                var source = raw.find('.' + sid);
                return source[0] && source;
            }
        },

        getCustom: function(tag, cell, raw, fn){
            var tags = cell.find(tag);
            if (!tags.length) {
                return [{}];
            }
            return tags.map(function(elm){
                var source = exports.getSource(elm, raw);
                if (source) {
                    var content = source.find(tag);
                    if (!content[0]) {
                        content = source;
                    }
                    return fn(content, elm);
                }
                return fn(elm);
            });
        }

    }; 

    return exports;

});
