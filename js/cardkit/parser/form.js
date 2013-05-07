
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    var getCustom = util.getCustom,
        getHd = util.getHd,
        getItemDataOuter = util.getItemDataOuter;

    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                blank: unit.data('cfgBlank'),
                plainhd: unit.data('cfgPlainhd')
            },
            hd = getHd(source && source.find('.ckd-hd')),
            hd_link = getHd(source && source.find('.ckd-hd-link')),
            hd_opt = getItemDataOuter(source && source.find('.ckd-hdopt'), 'hdopt'),
            ft = getHd(source && source.find('.ckd-ft')),
            items = source && source.find('.ckd-item').map(getFormItemData),
            custom_hd = getCustom('.ckd-hd', unit, raw, getHd)[0] || {},
            custom_hd_link = getCustom('.ckd-hd-link', unit, raw, getHd)[0] || {},
            custom_hd_opt = getCustom('.ckd-hdopt', unit, raw, getItemDataOuter, 'hdopt').join(''),
            custom_ft = getCustom('.ckd-ft', unit, raw, getHd)[0] || {},
            custom_items = getCustom('.ckd-item', unit, raw, getFormItemData);
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

    function getFormItemData(item, custom, ckdname, raw){
        item = $(item);
        var data = {
            content: getCustom('.ckd-content', item, raw, getItemDataOuter, 'content'),
        };
        return util.mergeSource(data, custom, getFormItemData, raw);
    }

    return exports;

});
