
define(function(require){

var darkdom = require('darkdom'),
    _ = require('mo/lang/mix'),
    convert = require('mo/template/micro').convertTpl,
    helper = require('../helper'),
    render_title = convert(require('../tpl/page/title').template),
    render_nav = convert(require('../tpl/page/nav').template),
    render_banner = convert(require('../tpl/page/banner').template),
    render_actionbar = convert(require('../tpl/page/actionbar').template),
    render_action = convert(require('../tpl/page/actionbar/action').template),
    render_page = convert(require('../tpl/page').template);

var cards = {
    box: require('./box').box,
    list: require('./list').list, 
    mini: require('./mini').mini, 
    form: require('./form').form,
};

var exports = {

    title: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_title
        });
    },

    nav: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_nav
        });
    },

    banner: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                data.isBlank = helper.isBlank(data.content);
                return render_banner(data);
            }
        });
    },

    action: function(){
        return darkdom({
            enableSource: true,
            entireAsContent: true,
            render: render_action
        });
    },

    actionbar: function(){
        var component = darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                var limit = data.state.limit || 1;
                data.visibleActions = [];
                data.overflowActions = [];
                data.componentData.action.forEach(function(action, i){
                    var action_html = data.component.action[i];
                    if (this.length < limit
                            && !action.state.forceOverflow) {
                        this.push(action_html);
                    } else {
                        data.overflowActions.push(action_html);
                    }
                }, data.visibleActions);
                return render_actionbar(data);
            }
        }).contain('action', exports.action);
        helper.forwardActionEvents(component);
        return component;
    },

    blank: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return '<div>' + data.content + '</div>';
            }
        });
    },

    footer: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return '<div>' + data.content + '</div>';
            }
        });
    },

    page: function(){
        var page = darkdom({
            render: function(data){
                var com = data.component;
                data.hasHeader = com.title 
                    || com.nav || com.actionbar;
                data.isBlank = helper.isBlank(data.content);
                return render_page(data);
            } 
        });
        var parts = _.copy(exports);
        delete parts.page;
        page.contain(parts);
        page.contain(cards, { content: true });
        page.response('state:isPageActive', when_page_active);
        page.response('state:isDeckActive', when_deck_active);
        page.response('state:currentDeck', when_deck_change);
        helper.forwardStateEvents(page);
        return page;
    }

};

function when_page_active(changes){
    if (changes.newValue === 'true') {
        changes.root.css('min-height', window.innerHeight * 1.4 + 'px')
            .attr('data-page-active', true);
        setTimeout(function(){
            changes.root.addClass('topbar-enabled');
            window.scrollTo(0, 0);
        }, 100);
    } else {
        changes.root.attr('data-page-active', false)
            .removeClass('topbar-enabled');
    }
    return false;
}

function when_deck_active(changes){
    if (changes.newValue === 'true') {
        changes.root.css('min-height', window.innerHeight * 1.4 + 'px')
            .attr('data-deck-active', true);
    } else {
        changes.root.attr('data-deck-active', false);
        setTimeout(function(){
            window.scrollTo(0, 0);
        }, 300);
    }
    return false;
}

function when_deck_change(changes){
    changes.root.attr('data-curdeck', changes.newValue);
    return false;
}

return exports;

});

