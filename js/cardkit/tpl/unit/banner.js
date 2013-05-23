define([], function(){

    return {"template":"\n<article class=\"ck-unit-wrap {%=(!data.hasContent && 'empty' || '')%}\">\n\n    {% if (data.hasContent) { %}\n    <section>{%= data.content %}</section>\n    {% } %}\n\n</article>\n\n<div class=\"ck-top-tips\"><span>tips: 点击顶栏可返回顶部，向下拖拽顶栏可显示网址</span></div>\n\n"}; 

});