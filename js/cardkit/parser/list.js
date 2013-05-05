
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    var getItemData = util.getItemData;

    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                blank: unit.data('cfgBlank'),
                limit: unit.data('cfgLimit'),
                col: unit.data('cfgCol'),
                paper: unit.data('cfgPaper'),
                plain: unit.data('cfgPlain'),
                plainhd: unit.data('cfgPlainhd')
            },
            hd = get_hd(source && source.find('.ckd-hd')),
            hd_link = get_hd(source && source.find('.ckd-hd-link')),
            hd_opt = get_all_outer(source && source.find('.ckd-hdopt'), 'hdopt'),
            ft = get_hd(source && source.find('.ckd-ft')),
            items = source && source.find('.ckd-item').map(getItemData),
            custom_hd = (util.getCustom('.ckd-hd', unit, raw, get_hd) || [{}])[0],
            custom_hd_link = (util.getCustom('.ckd-hd-link', unit, raw, get_hd) || [{}])[0],
            custom_hd_opt = (util.getCustom('.ckd-hdopt', unit, raw, get_all_outer, 'hdopt') || []).join(''),
            custom_ft = (util.getCustom('.ckd-ft', unit, raw, get_hd) || [{}])[0],
            custom_items = util.getCustom('.ckd-item', unit, raw, getItemData) || $();
        var data = {
            config: config,
            style: unit.data('style'),
            items: custom_items.concat(items || $()),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd_link.href 
                || custom_hd_link.href !== null && hd_link.href 
                || custom_hd.href 
                || custom_hd.href !== null && hd.href,
            hd_opt: custom_hd_opt + hd_opt,
            ft: custom_ft.html === undefined ? ft.html : custom_ft.html
        };
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

    function get_all_outer(source, custom, ckdname){
        source = $(source);
        var data = util.getOuterHTML(source, ckdname) || '';
        source.remove();
        return data;
    }

    return exports;

});

