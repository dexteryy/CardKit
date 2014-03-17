
define(function(require){

var darkdom = require('darkdom'),
    _ = require('mo/lang/mix'),
    convert = require('mo/template/micro').convertTpl,
    helper = require('../helper'),
    render_item = convert(require('../tpl/item').template),
    render_title = convert(require('../tpl/item/title').template),
    render_title_prefix = convert(require('../tpl/item/title_prefix').template),
    render_title_suffix = convert(require('../tpl/item/title_suffix').template),
    render_title_tag = convert(require('../tpl/item/title_tag').template),
    render_icon = convert(require('../tpl/item/icon').template),
    render_desc = convert(require('../tpl/item/desc').template),
    render_info = convert(require('../tpl/item/info').template),
    render_opt = convert(require('../tpl/item/opt').template),
    render_content = convert(require('../tpl/item/content').template),
    render_meta = convert(require('../tpl/item/meta').template),
    render_author = convert(require('../tpl/item/author').template),
    render_author_prefix = convert(require('../tpl/item/author_prefix').template),
    render_author_suffix = convert(require('../tpl/item/author_suffix').template),
    render_avatar = convert(require('../tpl/item/avatar').template),
    render_author_desc = convert(require('../tpl/item/author_desc').template),
    render_author_info = convert(require('../tpl/item/author_info').template),
    render_author_meta = convert(require('../tpl/item/author_meta').template);

var exports = {

    title: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_title
        });
    },

    titleLink: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return data.state.link;
            }
        });
    },

    titlePrefix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_title_prefix
        });
    },

    titleSuffix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_title_suffix
        });
    },

    titleTag: function(){
        return darkdom({
            enableSource: true,
            render: render_title_tag
        });
    },

    icon: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_icon
        });
    },

    desc: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_desc
        });
    },

    info: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_info
        });
    },

    opt: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_opt
        });
    },

    content: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_content
        });
    },

    meta: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_meta
        });
    },

    author: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_author
        });
    },

    authorLink: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return data.state.link;
            }
        });
    },

    authorPrefix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_prefix
        });
    },

    authorSuffix: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_suffix
        });
    },

    avatar: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_avatar
        });
    },

    authorDesc: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_desc
        });
    },

    authorInfo: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_info
        });
    },

    authorMeta: function(){
        return darkdom({
            enableSource: true,
            sourceAsContent: true,
            render: render_author_meta
        });
    },

    item: function(){
        var item = darkdom({
            enableSource: true,
            render: function(data){
                var read_state = helper.readState;
                var state = data.state;
                var com = data.component;
                var comdata = data.componentData;
                var link_data = com.titleLink 
                    ? comdata.titleLink : comdata.title;
                data.itemLinkTarget = read_state(link_data, 'linkTarget')
                    || state.linkTarget;
                data.isItemLinkAlone = read_state(link_data, 'isAlone')
                    || state.isAlone;
                data.itemLink = com.titleLink
                    || read_state(comdata.title, 'link')
                    || state.link;
                data.itemContent = com.title || data.content;
                var author_data = com.authorLink 
                    ? comdata.authorLink : comdata.author;
                data.authorLinkTarget = read_state(author_data, 'linkTarget');
                data.authorLink = com.authorLink
                    || read_state(comdata.author, 'link');
                return render_item(data);
            }
        });
        var parts = _.copy(exports);
        delete parts.item;
        item.contain(parts);
        return item;
    }

};

return exports;

});
