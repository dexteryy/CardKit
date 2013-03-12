
define([
    'dollar',
    'mo/lang'
], function($){

    var exports = {

        getSource: function(node, raw){
            var sid = $(node).data('source');
            if (sid) {
                var source = raw.find('.' + sid);
                return source[0] && source;
            }
        },

        getCustom: function(tag, unit, raw, fn){
            var tags = unit.find(tag);
            if (!tags.length) {
                return;
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
        },

        getHref: function(nodes){
            for (var href, i = 0, l = nodes.length; i < l; i++) {
                href = nodes[i].href;
                if (href) {
                    return href;
                }
            }
        },

        getText: function(nodes){
            return nodes.map(function(elm){
                return elm.textContent;
            }).join('');
        },

        getInnerHTML: function(nodes){
            return nodes.map(function(elm){
                return elm.innerHTML;
            }, $).join('');
        },

        getOuterHTML: function(nodes){
            return nodes.map(function(elm){
                return elm.outerHTML;
            }, $).join('');
        }

    }; 

    return exports;

});
