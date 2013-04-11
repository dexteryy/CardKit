
define([
    'dollar',
    'mo/lang',
    'mo/template',
    './tpl/unit/box',
    './tpl/unit/list',
    './tpl/unit/mini',
    './tpl/unit/form',
    './tpl/unit/blank',
    './parser/box',
    './parser/list',
    './parser/mini',
    './parser/form',
    './supports'
], function($, _, tpl, 
    tpl_box, tpl_list, tpl_mini, tpl_form, tpl_blank,
    boxParser, listParser, miniParser, formParser,
    supports){

    var TPL_TIPS = '<div class="ck-top-tips">'
        + (supports.SAFARI_TOPBAR ? '长按顶部导航条，可拖出浏览器地址栏' : '')
        + '</div>';

    var exports = {

        initCard: function(card, raw, footer, opt) {

            var units = card.find('.ck-box-unit, .ck-mini-unit, .ck-list-unit, .ck-form-unit');

            var has_content = exports.initUnit(units, raw);

            if (!has_content && !opt.isModal) {
                card.append(tpl_blank.template);
            }

            if (!opt.isModal) {
                card.append(footer.clone())
                    .prepend($('.ck-banner-unit', card))
                    .prepend(TPL_TIPS);
            }

        },

        initUnit: function(units, raw){
            var has_content;
            $(units).forEach(function(unit){
                var type = (/ck-(\w+)-unit/.exec(unit.className) || [])[1];
                if (type) {
                    if (exports[type](unit, raw)) {
                        has_content = true;
                    }
                }
            });
            return has_content;
        },

        box: function(unit, raw){
            var data = boxParser(unit, raw);
            if (data.hasContent || data.hd) {
                unit.innerHTML = tpl.convertTpl(tpl_box.template, data, 'data');
                return true;
            } else {
                $(unit).remove();
            }
        },

        mini: function(unit, raw){
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
                return false;
            } else {
                $(unit).remove();
            }
        },

        list: function(unit, raw){
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
                return true;
            } else {
                $(unit).remove();
            }
        },

        form: function(unit, raw){
            var data = formParser(unit, raw);
            if (data.hd || data.items.length) {
                unit.innerHTML = tpl.convertTpl(tpl_form.template, data, 'data');
                return true;
            } else {
                $(unit).remove();
            }
        }
    
    };

    return exports;

});
