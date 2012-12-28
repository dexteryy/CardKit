
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    function exports(cell, raw){
        cell = $(cell);
        var source = util.getSource(cell, raw),
            config = {
                plain: cell.data('cfgPlain')
            },
            hd = get_hd(source && source.find('.ckd-hd')),
            ft = get_hd(source && source.find('.ckd-ft')),
            contents = source && (source.find('.ckd-content')
                .map(function(node){
                    return node.outerHTML;
                }).join('') || source.html()),
            custom_hd = util.getCustom('.ckd-hd', cell, raw, get_hd)[0],
            custom_ft = util.getCustom('.ckd-ft', cell, raw, get_hd)[0];
        util.getCustom('.ckd-content', cell, raw, replace_content);
        var data = {
            config: config,
            style: cell.data('style'),
            content: cell[0].innerHTML + (contents || ''),
            hd: custom_hd.html || hd.html,
            hd_url: custom_hd.href || hd.href,
            ft: custom_ft.html || ft.html
        };
        return data;
    }

    function replace_content(source, custom){
        $(custom).replaceWith(source.clone());
    }

    function get_hd(source, custom){
        source = $(source);
        var data = source && {
            html: source.html(),
            href: source.attr('href')
        } || {};
        if (custom) {
            var custom_data = get_hd(custom);
            for (var i in custom_data) {
                if (custom_data[i]) {
                    data[i] = custom_data[i];
                }
            }
            $(custom).remove();
        }
        return data;
    }

    return exports;

});
