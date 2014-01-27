
define(function(require){

var darkdom = require('darkdom'),
    convert = require('mo/template/micro').convertTpl,
    helper = require('../../helper'),
    render_hd = convert(require('../../tpl/scaffold/hd').template),
    render_hdopt = convert(require('../../tpl/scaffold/hd_opt').template),
    render_ft = convert(require('../../tpl/scaffold/ft').template);

var exports = {

    hd: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                var hdlink_data = data.context.componentData.hdLink;
                var hd_link = helper.readState(hdlink_data, 'link');
                data.hdLink = hd_link
                    || data.state.link;
                data.hdLinkTarget = hd_link 
                    ? helper.readState(hdlink_data, 'linkTarget')
                    : data.state.linkTarget;
                return render_hd(data);
            }
        });
    },

    hdLink: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return data.state.link;
            }
        });
    },

    hdOpt: function(){
        return darkdom({
            enableSource: true,
            entireAsContent: true,
            render: render_hdopt
        });
    },

    ft: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: render_ft
        });
    },

    blank: function(){
        return darkdom({
            unique: true,
            enableSource: true,
            render: function(data){
                return '<div>' + data.content + '</div>';
            }
        });
    }

};

return exports;

});

