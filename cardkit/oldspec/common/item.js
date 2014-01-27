
define([
    '../../helper'
], function(helper){

var source_states = {
    source: helper.readSource
};

return {
    title: function(guard){
        guard.watch('.ckd-title');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-title-link-extern') 
                    && (node.attr('target') || '_blank');
            },
            isAlone: function(node){
                return node.hasClass('ckd-title-link-alone');
            }
        });
    },
    titleLink: function(guard){
        guard.watch('.ckd-title-link');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-title-link-extern') 
                    && (node.attr('target') || '_blank');
            },
            isAlone: function(node){
                return node.hasClass('ckd-title-link-alone');
            }
        });
    },
    titlePrefix: function(guard){
        guard.watch('.ckd-title-prefix');
        guard.state(source_states);
    },
    titleSuffix: function(guard){
        guard.watch('.ckd-title-suffix');
        guard.state(source_states);
    },
    titleTag: function(guard){
        guard.watch('.ckd-title-tag');
        guard.state(source_states);
    },
    icon: function(guard){
        guard.watch('.ckd-icon');
        guard.state(source_states);
        guard.state({
            imgUrl: 'src'
        });
    },
    info: function(guard){
        guard.watch('.ckd-info');
        guard.state(source_states);
    },
    opt: function(guard){
        guard.watch('.ckd-opt');
        guard.state(source_states);
    },
    desc: function(guard){
        guard.watch('.ckd-desc, .ckd-subtitle');
        guard.state(source_states);
    },
    content: function(guard){
        guard.watch('.ckd-content');
        guard.state(source_states);
    },
    meta: function(guard){
        guard.watch('.ckd-meta');
        guard.state(source_states);
    },
    author: function(guard){
        guard.watch('.ckd-author');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-author-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    authorLink: function(guard){
        guard.watch('.ckd-author-link');
        guard.state(source_states);
        guard.state({
            link: 'href',
            linkTarget: function(node){
                return node.hasClass('ckd-author-link-extern') 
                    && (node.attr('target') || '_blank');
            }
        });
    },
    authorPrefix: function(guard){
        guard.watch('.ckd-author-prefix');
        guard.state(source_states);
    },
    authorSuffix: function(guard){
        guard.watch('.ckd-author-suffix');
        guard.state(source_states);
    },
    avatar: function(guard){
        guard.watch('.ckd-avatar');
        guard.state(source_states);
        guard.state({
            imgUrl: 'src'
        });
    },
    authorInfo: function(guard){
        guard.watch('.ckd-author-info');
        guard.state(source_states);
    },
    authorDesc: function(guard){
        guard.watch('.ckd-author-desc');
        guard.state(source_states);
    },
    authorMeta: function(guard){
        guard.watch('.ckd-author-meta');
        guard.state(source_states);
    }
};

});

