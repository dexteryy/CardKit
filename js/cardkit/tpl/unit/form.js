define([], function(){

    return {"template":"\n<article>\n\n    {% if (data.hd) { %}\n    <header>\n        {% if (data.hd_url) { %}\n        <a href=\"{%= data.hd_url %}\" class=\"ck-link\">{%= data.hd %}</a>\n        {% } else { %}\n        <span>{%= data.hd %}</span>\n        {% } %}\n    </header>\n    {% } %}\n\n    <section>\n    {% if (!data.items.length) { %}\n    <div class=\"ck-item blank\">目前还没有内容</div>\n    {% } %}\n    {% data.items.forEach(function(item){ %}\n        <div class=\"ck-item\">\n            {%= item.content %}\n        </div>\n    {% }); %}\n    </section>\n\n    {% if (data.ft) { %}\n    <footer>{%= data.ft %}</footer>\n    {% } %}\n\n</article>\n\n"}; 

});