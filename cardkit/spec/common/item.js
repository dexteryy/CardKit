
define([], function(){

return {
    title: function(guard){
        guard.watch('ck-part[type="title"]');
        guard.state({
            link: 'href',
            linkTarget: 'target',
            isAlone: 'alone-mode'
        });
    },
    titleLink: function(guard){
        guard.watch('ck-part[type="titleLink"]');
        guard.state({
            link: 'href',
            linkTarget: 'target',
            isAlone: 'alone-mode'
        });
    },
    titlePrefix: 'ck-part[type="titlePrefix"]',
    titleSuffix: 'ck-part[type="titleSuffix"]',
    titleTag: 'ck-part[type="titleTag"]',
    icon: function(guard){
        guard.watch('ck-part[type="icon"]');
        guard.state({
            imgUrl: 'src'
        });
    },
    info: 'ck-part[type="info"]',
    opt: function(guard){
        guard.watch('ck-part[type="opt"]');
    },
    desc: 'ck-part[type="desc"]',
    content: 'ck-part[type="content"]',
    meta: 'ck-part[type="meta"]',
    author: function(guard){
        guard.watch('ck-part[type="author"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    authorLink: function(guard){
        guard.watch('ck-part[type="authorLink"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    authorPrefix: 'ck-part[type="authorPrefix"]',
    authorSuffix: 'ck-part[type="authorSuffix"]',
    avatar: function(guard){
        guard.watch('ck-part[type="avatar"]');
        guard.state({
            imgUrl: 'src'
        });
    },
    authorInfo: 'ck-part[type="authorInfo"]',
    authorDesc: 'ck-part[type="authorDesc"]',
    authorMeta: 'ck-part[type="authorMeta"]'
};

});

