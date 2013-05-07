define([], function(){

    return {"template":"\n<article>\n\n    {% if (data.hd) { %}\n    <header>\n\n        <span class=\"ck-hd {%= (data.hd_url && 'clickable' || '') %}\">\n            {% if (data.hd_url) { %}\n            <a href=\"{%= data.hd_url %}\" class=\"ck-link ck-link-mask {%= (data.hd_url_extern ? 'ck-link-extern' : '') %}\"></a>\n            {% } %}\n            <span>{%= data.hd %}</span>\n        </span>\n\n        {% if (data.hd_opt) { %}\n        <div class=\"ck-hdopt-wrap\">{%=data.hd_opt%}</div>\n        {% } %}\n\n    </header>\n    {% } %}\n\n    {% if (data.hasContent) { %}\n    <section>{%= data.content %}</section>\n    {% } %}\n\n    {% if (data.ft) { %}\n    <footer>{%= data.ft %}</footer>\n    {% } %}\n\n</article>\n"}; 

});