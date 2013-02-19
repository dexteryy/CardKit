
define(['mo/lang'], function(){

    var exports = {

        init: function(){
            this.name = 'ck_ss';
            if (sessionStorage[this.name]) {
                this.list = JSON.parse(sessionStorage[this.name]);
            } else {
                this.reset();
            }
        },

        reset: function(){
            this.list = [];
            this.save();
        },

        save: function(){
            sessionStorage[this.name] = JSON.stringify(this.list);
        },

        indexOf: function(url){
            var n = this.list.map(function(item){
                return item[0];
            }).indexOf(url);
            return (n === -1 || this.list[n][1] < history.length) ? n : -1;
        },

        push: function(url){
            this.list.push([url, history.length]);
            this.save();
        },

        clear: function(n){
            if (n !== -1) {
                this.list = this.list.slice(0, n + 2);
                this.save();
            }
        }

    };

    return exports;

});
