
define([
    'dollar',
    'mo/lang',
    './util'
], function($, _, util){
    
    function exports(cell, raw){
        cell = $(cell);
        var source = util.getSource(cell, raw),
            config = {
                limit: cell.data('cfgLimit'),
                col: cell.data('cfgCol'),
                paper: cell.data('cfgPaper'),
                plain: cell.data('cfgPlain')
            },
            hd = get_hd(source && source.find('.ckd-hd')),
            ft = get_hd(source && source.find('.ckd-ft')),
            items = source && source.find('.ckd-item').map(get_item),
            custom_hd = (util.getCustom('.ckd-hd', cell, raw, get_hd) || [{}])[0],
            custom_ft = (util.getCustom('.ckd-ft', cell, raw, get_hd) || [{}])[0],
            custom_items = util.getCustom('.ckd-item', cell, raw, get_item) || $();
        var data = {
            config: config,
            style: cell.data('style'),
            items: custom_items.concat(items || $()),
            hd: custom_hd.html || hd.html,
            hd_url: custom_hd.href || custom_hd.href !== null && hd.href,
            ft: custom_ft.html || ft.html
        };
        return data;
    }

    function get_item(item, custom){
        item = $(item);
        var title = item.find('.ckd-title'),
            author = item.find('.ckd-author');
        var data = {
            title: title.text(),
            href: title.attr('href'),
            author: author.text(),
            author_url: author.attr('href'),
            info: item.find('.ckd-info').text(),
            subtitle: item.find('.ckd-subtitle').text(),
            meta: item.find('.ckd-meta').map(function(node){
                return node.innerHTML;
            }),
            icon: item.find('.ckd-icon').attr('src'),
            content: item.find('.ckd-content').html()
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
            html: source.html(),
            href: source.attr('href')
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

