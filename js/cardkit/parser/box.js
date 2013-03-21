
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    function exports(unit, raw){
        unit = $(unit);
        var source = util.getSource(unit, raw),
            config = {
                paper: unit.data('cfgPaper'),
                plain: unit.data('cfgPlain')
            },
            hd = get_hd(source && source.find('.ckd-hd')),
            ft = get_hd(source && source.find('.ckd-ft')),
            contents = source && (
                util.getOuterHTML(source.find('.ckd-content'))
                || util.getInnerHTML(source)
            ),
            custom_hd = (util.getCustom('.ckd-hd', unit, raw, get_hd) || [{}])[0],
            custom_ft = (util.getCustom('.ckd-ft', unit, raw, get_hd) || [{}])[0];
        util.getCustom('.ckd-content', unit, raw, replace_content);
        var data = {
            config: config,
            style: unit.data('style'),
            content: unit[0].innerHTML + (contents || ''),
            hd: custom_hd.html === undefined ? hd.html : custom_hd.html,
            hd_url: custom_hd.href || custom_hd.href !== null && hd.href,
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
        }
    }

    function get_hd(source, custom_source){
        source = $(source);
        var data = source && {
            html: util.getText(source),
            href: util.getHref(source)
        } || {};
        if (custom_source && typeof custom_source === 'object') {
            var custom_data = get_hd(custom_source);
            for (var i in custom_data) {
                if (custom_data[i]) {
                    data[i] = custom_data[i];
                }
            }
        }
        source.remove();
        return data;
    }

    return exports;

});
