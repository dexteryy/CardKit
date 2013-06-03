define([], function(){

    return {"template":"\n{% if (navdrawer.hd) { %}\n<header>{%=navdrawer.hd%}</header>\n{% } %}\n\n<article>\n    <div class=\"ck-nav-wrap\">\n        <div class=\"ck-nav-content\">{%=navdrawer.content%}</div>\n        <div class=\"ck-footer\"></div>\n    </div>\n</article>\n\n"}; 

});