
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    var getInnerHTML = util.getInnerHTML;

    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                limit: unit.data('cfgLimit'),
                plain: unit.data('cfgPlain')
            },
            hd = get_hd(source && source.find('.ckd-hd')),
            items = source && source.find('.ckd-item'),
            custom_hd = (util.getCustom('.ckd-hd', unit, raw, get_hd) || [{}])[0],
            custom_items = util.getCustom('.ckd-item', unit, raw, get_item) || $();
        if (source && !items[0]) {
            items = source;
        }
        items = items && items.map(get_item);
        var data = {
            config: config,
            style: unit.data('style'),
            items: custom_items.concat(items || $()),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd.href || custom_hd.href !== null && hd.href
        };
        return data;
    }

    function get_item(item, custom){
        item = $(item);
        var title = item.find('.ckd-title'),
            author = item.find('.ckd-author');
        var data = {
            title: getInnerHTML(title),
            href: util.getHref(title),
            author: getInnerHTML(author),
            author_url: util.getHref(author),
            info: getInnerHTML(item.find('.ckd-info')),
            subtitle: getInnerHTML(item.find('.ckd-subtitle')),
            meta: item.find('.ckd-meta').map(function(node){
                return node.innerHTML;
            }),
            icon: item.find('.ckd-icon').attr('src'),
            content: util.getOuterHTML(item.find('.ckd-content'))
        };
        if (custom && typeof custom === 'object') {
            custom = get_item(custom);
            for (var i in custom) {
                if (custom[i]) {
                    data[i] = custom[i];
                }
            }
        }
        return data;
    }

    function get_hd(source, custom){
        source = $(source);
        var data = source && {
            html: getInnerHTML(source),
            href: util.getHref(source)
        } || {};
        if (custom && typeof custom === 'object') {
            custom = get_hd(custom);
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
