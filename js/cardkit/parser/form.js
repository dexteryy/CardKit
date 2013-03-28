
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                plainhd: unit.data('cfgPlainhd')
            },
            hd = get_hd(source && source.find('.ckd-hd')),
            hd_opt = get_all_outer(source && source.find('.ckd-hdopt')),
            ft = get_hd(source && source.find('.ckd-ft')),
            items = source && source.find('.ckd-item').map(get_item),
            custom_hd = (util.getCustom('.ckd-hd', unit, raw, get_hd) || [{}])[0],
            custom_hd_opt = (util.getCustom('.ckd-hdopt', unit, raw, get_all_outer) || []).join(''),
            custom_ft = (util.getCustom('.ckd-ft', unit, raw, get_hd) || [{}])[0],
            custom_items = util.getCustom('.ckd-item', unit, raw, get_item) || $();
        var data = {
            config: config,
            style: unit.data('style'),
            items: custom_items.concat(items || $()),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd.href || custom_hd.href !== null && hd.href,
            hd_opt: custom_hd_opt + hd_opt,
            ft: custom_ft.html === undefined ? ft.html : custom_ft.html
        };
        return data;
    }

    function get_item(item, custom){
        item = $(item);
        var data = {
            content: util.getInnerHTML(item)
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
            html: util.getInnerHTML(source),
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

    function get_all_outer(source){
        source = $(source);
        var data = util.getOuterHTML(source) || '';
        source.remove();
        return data;
    }

    return exports;

});
