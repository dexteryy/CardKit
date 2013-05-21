
define([
    'dollar',
    'mo/lang',
    'mo/template',
    './tpl/unit/box',
    './tpl/unit/list',
    './tpl/unit/mini',
    './tpl/unit/form',
    './tpl/unit/banner',
    './tpl/unit/blank',
    './parser/box',
    './parser/list',
    './parser/mini',
    './parser/form',
    './parser/banner',
    './supports'
], function($, _, tpl, 
    tpl_box, tpl_list, tpl_mini, tpl_form, tpl_banner, tpl_blank,
    boxParser, listParser, miniParser, formParser, bannerParser,
    supports){

    var SCRIPT_TAG = 'script[type="text/cardscript"]',

        TPL_TIPS = '<div class="ck-top-tips">'
        + (supports.HIDE_TOPBAR ? '按住顶栏，往下拖拽，可拖出浏览器地址栏' : '')
        + '</div>';

    var exports = {

        initCard: function(card, raw, footer, opt) {

            var units = card.find('.ck-box-unit, .ck-mini-unit, .ck-list-unit, .ck-form-unit, .ck-banner-unit'),
                config = {
                    blank: card.data('cfgBlank')
                };

            if (!opt.isModal) {
                card.find(SCRIPT_TAG + '[data-hook="source"]').forEach(run_script);
                card.prepend($('.ck-banner-unit', card));
            }

            var has_content = exports.initUnit(units, raw);

            if (!has_content && !opt.isModal && config.blank != 'false') {
                card.append(tpl.convertTpl(tpl_blank.template, {
                    config: config
                }, 'data'));
            }

            if (!opt.isModal) {

                card.append(footer.clone())
                    .prepend(TPL_TIPS);

                card.find(SCRIPT_TAG + '[data-hook="ready"]').forEach(run_script);

            }

        },

        openCard: function(card, opt){
            if (!opt.isModal) {
                card.find(SCRIPT_TAG + '[data-hook="open"]').forEach(run_script);
            }
        },

        closeCard: function(card, opt){
            if (!opt.isModal) {
                card.find(SCRIPT_TAG + '[data-hook="close"]').forEach(run_script);
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

        banner: function(unit, raw){
            var data = bannerParser(unit, raw);
            if (data.hasContent) {
                unit.innerHTML = tpl.convertTpl(tpl_banner.template, data, 'data');
            } else {
                $(unit).remove();
            }
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
                if (!item.title && !item.author 
                        && (!item.content || !item.content.length)) {
                    return false;
                }
                return true;
            }, data);
            if (!data.items.length 
                    && (!data.hd || data.config.blank == 'false')) {
                $(unit).remove();
                return;
            }
            if (data.config.limit 
                    && data.config.limit < data.items.length) {
                data.items.length = data.config.limit;
            }
            unit.innerHTML = tpl.convertTpl(tpl_mini.template, data, 'data');
            return true;
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
            if (data.config.limit 
                    && data.config.limit < data.items.length) {
                data.items.length = data.config.limit;
            }
            if (!data.items.length 
                    && (!data.hd || data.config.blank == 'false')) {
                $(unit).remove();
            } else {
                unit.innerHTML = tpl.convertTpl(tpl_list.template, data, 'data');
                return true;
            }
        },

        form: function(unit, raw){
            var data = formParser(unit, raw);
            if (!data.items.length 
                    && (!data.hd || data.config.blank == 'false')) {
                $(unit).remove();
            } else {
                unit.innerHTML = tpl.convertTpl(tpl_form.template, data, 'data');
                return true;
            }
        }
    
    };

    function run_script(script){
        window["eval"].call(window, script.innerHTML);
    }

    return exports;

});
