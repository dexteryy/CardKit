define([], function(){

    return {"template":"\n<ul>\n{% mod.items.forEach(function(item){ %}\n    <li class=\"ck-item\">\n        <a class=\"ck-link\" href=\"{%= item.href %}\">{%= item.title %}</a>\n        <span class=\"info\">{%= item.info %}</span>\n    </li>\n{% }); %}\n</ul>\n"}; 

});