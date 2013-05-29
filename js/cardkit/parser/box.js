
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
                paper: unit.data('cfgPaper'),
                plain: unit.data('cfgPlain'),
                plainhd: unit.data('cfgPlainhd')
            },
            hd = getHd(source && source.find('.ckd-hd')),
            hd_link_extern = getHd(source && source.find('.ckd-hd-link-extern')),
            hd_link = hd_link_extern.href 
                ? hd_link_extern
                : getHd(source && source.find('.ckd-hd-link')),
            hd_opt = getItemDataOuter(source && source.find('.ckd-hdopt'), 'hdopt'),
            ft = getHd(source && source.find('.ckd-ft')),
            contents = source && util.getOuterHTML(source.find('.ckd-content')),
            custom_hd = getCustom('.ckd-hd', unit, raw, take_hd)[0] || {},
            custom_hd_link_extern = getCustom('.ckd-hd-link-extern', unit, raw, take_hd)[0] || {},
            custom_hd_link = custom_hd_link_extern.href 
                ? custom_hd_link_extern
                : (getCustom('.ckd-hd-link', unit, raw, take_hd)[0] || {}),
            custom_hd_opt = getCustom('.ckd-hdopt', unit, raw, take_item_outer, 'hdopt').join(''),
            custom_ft = getCustom('.ckd-ft', unit, raw, take_hd)[0] || {};
        getCustom('.ckd-content', unit, raw, replace_content);
        var data = {
            config: config,
            style: unit.data('style'),
            content: unit[0].innerHTML + (contents || ''),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd_link.href 
                || custom_hd_link.href !== null && hd_link.href 
                || custom_hd.href 
                || custom_hd.href !== null && hd.href,
            hd_url_extern: custom_hd_link_extern.href || hd_link_extern.href,
            hd_opt: custom_hd_opt + hd_opt,
            ft: custom_ft.html === undefined ? ft.html 
                : (custom_ft.html || (config.plain || config.paper) && ' ')
        };
        if (data.content && /\S/.test(data.content)){
            data.hasContent = true;
        }
        return data;
    }

    function replace_content(source, custom){
        if (custom) {
            $(custom).replaceWith(source.clone());
        } else {
            source = $(source);
            if (!/\S/.test(source.html() || '')) {
                source.remove();
            }
        }
    }

    function take_hd(source, custom){
        var data = getHd(source, custom);
        $(source).remove();
        return data;
    }

    function take_item_outer(source, custom, ckdname){
        var data = getItemDataOuter(source, custom, ckdname);
        $(source).remove();
        return data;
    }

    return exports;

});
