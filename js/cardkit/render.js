
define([
    'dollar',
    'mo/lang',
    'mo/browsers',
    'mo/template',
    './tpl/unit/box',
    './tpl/unit/list',
    './tpl/unit/mini',
    './tpl/unit/form',
    './tpl/unit/blank',
    './parser/box',
    './parser/list',
    './parser/mini',
    './parser/form'
], function($, _, browsers, tpl, 
    tpl_box, tpl_list, tpl_mini, tpl_form, tpl_blank,
    boxParser, listParser, miniParser, formParser){

    var TPL_TIPS = '<div class="ck-top-tips">'
        + (browsers.mobilesafari ? '长按顶部导航条，可拖出浏览器地址栏' : '')
        + '</div>';

    function exports(card, raw, footer, opt) {

        var has_content = false;

        card.find('.ck-box-unit').forEach(function(unit){
            var data = boxParser(unit, raw);
            if (data.hasContent || data.hd) {
                unit.innerHTML = tpl.convertTpl(tpl_box.template, data, 'data');
                has_content = true;
            } else {
                $(unit).remove();
            }
        });

        card.find('.ck-list-unit').forEach(function(unit){
            var data = listParser(unit, raw);
            data.items = data.items.filter(function(item){
                var style = this.style;
                if (style === 'more' || style === 'menu') {
                    if (!item.title) {
                        return false;
                    }
                } else if (style === 'grid') {
                    if (!item.icon) {
                        return false;
                    }
                } else if (!item.title && !item.author) {
                    return false;
                }
                return true;
            }, data);
            if (data.config.limit) {
                data.items.length = data.config.limit;
            }
            if (data.hd || data.items.length) {
                unit.innerHTML = tpl.convertTpl(tpl_list.template, data, 'data');
                has_content = true;
            } else {
                $(unit).remove();
            }
        });

        card.find('.ck-mini-unit').forEach(function(unit){
            var data = miniParser(unit, raw);
            data.items = data.items.filter(function(item){
                if (!item.content || !item.content.length) {
                    return false;
                }
                return true;
            }, data);
            if (!data.style) {
                data.config.limit = 1;
            }
            if (data.config.limit) {
                data.items.length = data.config.limit;
            }
            if (data.hd || data.items.length) {
                unit.innerHTML = tpl.convertTpl(tpl_mini.template, data, 'data');
                has_content = true;
            } else {
                $(unit).remove();
            }
        });

        card.find('.ck-form-unit').forEach(function(unit){
            var data = formParser(unit, raw);
            if (data.hd || data.items.length) {
                unit.innerHTML = tpl.convertTpl(tpl_form.template, data, 'data');
                has_content = true;
            } else {
                $(unit).remove();
            }
        });

        if (!has_content && !opt.isModal) {
            card.append(tpl_blank.template);
        }

        if (!opt.isModal) {
            card.append(footer.clone())
                .prepend($('.ck-banner-unit', card))
                .prepend(TPL_TIPS);
        }

    }

    return exports;

});
