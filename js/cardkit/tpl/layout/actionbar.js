define([], function(){

    return {"template":"\n{% if (actionbar.overflowItems.length) { %}\n<button type=\"button\" class=\"ck-top-overflow ck-item\"></button>\n{% } %}\n\n{% actionbar.items.reverse().forEach(function(item){ %}\n\n    {%=(item)%}\n\n{% }); %}\n\n<span class=\"ck-top-overflow-items\">\n{% actionbar.overflowItems.forEach(function(item){ %}\n\n    {%=(item)%}\n\n{% }); %}\n</span>\n"}; 

});