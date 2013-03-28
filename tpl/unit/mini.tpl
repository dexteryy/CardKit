
<article>

    {% if (data.hd) { %}
    <header>
        {% if (data.hd_url) { %}
        <a href="{%= data.hd_url %}" class="ck-link">{%= data.hd %}</a>
        {% } else { %}
        <span>{%= data.hd %}</span>
        {% } %}
        {% if (data.hd_opt) { %}
        <div class="ck-hdopt">{%=data.hd_opt%}</div>
        {% } %}
    </header>
    {% } %}

    {% if (data.style === 'slide') { %}
    <div class="ck-slide"><div class="ck-inslide">
    {% } %}

        {% if (!data.items.length) { %}
        <div class="ck-item enable blank">
            <div class="ck-content">目前还没有内容</div>
        </div>
        {% } %}

        {% data.items.forEach(function(item, i){ %}
        <div class="ck-item{%=(i === 0 && ' enable' || '')%}">
            {% if (item.title) { %}
            <p class="ck-title">{%= item.title %}</p>
            {% } %}
            <div class="ck-content">
                {%= item.content %}
                {% if (item.info) { %}
                <span class="ck-info">{%= item.info %}</span>
                {% } %}
            </div>
            {% if (item.author) { %}

            <p class="ck-initem">
                {% if (item.icon) { %}
                <img src="{%= item.icon %}" class="ck-icon"/>
                {% } %}
                {% if (item.author_url) { %}
                <a href="{%= item.author_url %}" class="ck-author ck-link">{%= item.author %}</a>
                {% } else if (item.author) { %}
                <span class="ck-author">{%= item.author %}</span>
                {% } %}
                {% if (item.subtitle) { %}
                <span class="ck-subtitle">{%= item.subtitle %}</span>
                {% } %}
            </p>
            {% if (item.meta && item.meta.length) { %}
            <span class="ck-meta">{%= item.meta.join('</span><span class="ck-meta">') %}</span>
            {% } %}

            {% } %}
        </div>
        {% }); %}

    {% if (data.style === 'slide') { %}
    </div></div>
    <footer>
        {% if (data.items.length > 1) { %}
        <div class="ck-page">
        {% data.items.forEach(function(item, i){ %}
            <span class="{%=(i === 0 && 'enable' || '')%}"></span>
        {% }); %}
        </div>
        {% } %}
    </footer>
    {% } %}

</article>

