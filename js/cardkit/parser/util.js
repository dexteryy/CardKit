
define([
    'dollar',
    'mo/lang'
], function($){

    var RE_CKD_NAME = /([^\w-])ckd\-([\w\-]+)(?=[^\w\-])/;

    var exports = {

        getSource: function(node, raw){
            var sid = $(node).data('source');
            if (sid) {
                var source = raw.find('.' + sid);
                return source[0] && source;
            }
        },

        getCustom: function(tag, unit, raw, fn, ckdname){
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
                    return fn(content, elm, ckdname);
                }
                return fn(elm, undefined, ckdname);
            });
        },

        getHref: getHref,

        getText: getText,

        getInnerHTML: getInnerHTML,

        getOuterHTML: getOuterHTML,

        getItemData: getItemData

    }; 

    function getHref(nodes){
        if (!nodes) {
            return;
        }
        for (var href, i = 0, l = nodes.length; i < l; i++) {
            href = nodes[i].href;
            if (href) {
                return href;
            }
        }
    }

    function getText(nodes){
        return nodes.map(function(elm){
            return elm.textContent;
        }).join('');
    }

    function getInnerHTML(nodes){
        return nodes.map(function(elm){
            return elm.innerHTML;
        }, $).join('');
    }

    function getOuterHTML(nodes, name){
        return nodes.map(function(elm){
            var html = elm.outerHTML;
            if (!name) {
                return html;
            }
            return html.replace(RE_CKD_NAME, function($0, $1, $2){ 
                if ($2 === name) {
                    return $1 + 'ck-' + $2;
                } else {
                    return $0;
                }
            });
        }, $).join('');
    }

    function getItemData(item, custom){
        item = $(item);
        var title = item.find('.ckd-title'),
            author = item.find('.ckd-author');
        if (!title[0] && getHref(item)) {
            title = item;
        }
        var data = {
            title: getInnerHTML(title),
            href: getHref(item.find('.ckd-title-link')) || getHref(title),
            titlePrefix: getOuterHTML(item.find('.ckd-title-prefix'), 'title-prefix'),
            titleSuffix: getOuterHTML(item.find('.ckd-title-suffix'), 'title-suffix'),
            titleTag: getOuterHTML(item.find('.ckd-title-tag'), 'title-tag'),
            icon: item.find('.ckd-icon').attr('src'),
            desc: getOuterHTML(item.find('.ckd-desc'), 'desc') 
                + getOuterHTML(item.find('.ckd-subtitle'), 'subtitle'),
            info: getOuterHTML(item.find('.ckd-info'), 'info'),
            content: getOuterHTML(item.find('.ckd-content'), 'content'),
            meta: getOuterHTML(item.find('.ckd-meta'), 'meta'),
            author: getInnerHTML(author),
            authorUrl: getHref(item.find('.ckd-author-link')) || getHref(author),
            authorPrefix: getOuterHTML(item.find('.ckd-author-prefix'), 'author-prefix'),
            authorSuffix: getOuterHTML(item.find('.ckd-author-suffix'), 'author-suffix'),
            avatar: item.find('.ckd-avatar').attr('src'),
            authorDesc: getOuterHTML(item.find('.ckd-author-desc'), 'author-desc'),
            authorMeta: getOuterHTML(item.find('.ckd-author-meta'), 'author-meta')
        };
        if (custom && typeof custom === 'object') {
            custom = getItemData(custom);
            for (var i in custom) {
                if (custom[i]) {
                    data[i] = custom[i];
                }
            }
        }
        return data;
    }

    return exports;

});
