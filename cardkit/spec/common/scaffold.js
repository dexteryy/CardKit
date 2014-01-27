
define([], function(){

return {
    hd: function(guard){
        guard.watch('ck-part[type="hd"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    hdLink: function(guard){
        guard.watch('ck-part[type="hdLink"]');
        guard.state({
            link: 'href',
            linkTarget: 'target'
        });
    },
    hdOpt: function(guard){
        guard.watch('ck-part[type="hdOpt"]');
    },
    ft: function(guard){
        guard.watch('ck-part[type="ft"]');
    },
    blank: function(guard){
        guard.watch('ck-part[type="blank"]');
    }
};

});

