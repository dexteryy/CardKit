
define([
    '../../helper'
], function(helper){

var source_states = {
    source: helper.readSource
};

return {
    hd: function(guard){
        guard.watch('.ckd-hd');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-hd-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    hdLink: function(guard){
        guard.watch('.ckd-hd-link:not(.ckd-hd)');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-hd-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    hdOpt: function(guard){
        guard.watch('.ckd-hdopt');
        guard.state(source_states);
    },
    ft: function(guard){
        guard.watch('.ckd-ft');
    },
    blank: function(guard){
        guard.watch('.ckd-blank');
    }
};

});

