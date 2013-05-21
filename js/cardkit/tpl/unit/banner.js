define([], function(){

    return {"template":"\n<article class=\"ck-unit-wrap\">\n\n    {% if (data.hasContent) { %}\n    <section>{%= data.content %}</section>\n    {% } %}\n\n</article>\n"}; 

});