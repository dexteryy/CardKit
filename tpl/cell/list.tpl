
{% function get_item(item){ %}
    {% if (item.href) { %}
        <a href="{%= item.href %}" class="ck-link ck-initem">{% get_content(item); %}</a>
    {% } else { %}
        <p class="ck-initem">{% get_content(item); %}</p>
    {% } %}
{% } %}

{% function get_content(item){ %}

    {% if (item.info) { %}
    <span class="ck-info">{%= item.info %}</span>
    {% } %}

    {% if (item.icon) { %}
    <img src="{%= item.icon %}" class="ck-icon"/>
    {% } %}

    {% if (item.title) { %}
    <span class="ck-title">{%= item.title %}</span>
    {% } %}

    {% if (data.style === 'post' || data.style === 'grid') { %}
        {% if (!item.href) { %}
            {% if (item.author_url) { %}
            <a href="{%= item.author_url %}" class="ck-link">{%= item.author %}</a>
            {% } else if (item.author) { %}
            <span class="ck-title">{%= item.author %}</span>
            {% } %}
        {% } %}
        {% if (item.subtitle) { %}
        <span class="ck-subtitle">{%= item.subtitle %}</span>
        {% } %}
    {% } %}

{% } %}


<article>

    {% if (data.hd) { %}
    <header>
        {% if (data.hd_url) { %}
        <a href="{%= data.hd_url %}" class="ck-link">{%= data.hd %}</a>
        {% } else { %}
        <span>{%= data.hd %}</span>
        {% } %}
    </header>
    {% } %}

    {% if (data.style === 'more') { %}

    <nav>
    {% data.items.forEach(function(item){ %}
        <div class="ck-item">
            {% get_item(item); %}
        </div>
    {% }); %}
    </nav>

    {% } else { %}

    <ul>
    {% data.items.forEach(function(item, i){ %}
        {% if (i && (i % data.config.col === 0)) { %}
            </ul><ul>
        {% } %}
        <li class="ck-item" style="width:{%= (data.config.col ? Math.floor(1000/data.config.col)/10 + '%' : '') %};">
            {% get_item(item); %}
            {% if (item.content) { %}
            <span class="ck-content">{%= item.content %}</span>
            {% } %}
            {% if (item.meta && item.meta.length) { %}
            <span class="ck-meta">{%= item.meta.join('</span><span class="ck-meta">') %}</span>
            {% } %}
        </li>
    {% }); %}
    </ul>

    {% } %}

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>
