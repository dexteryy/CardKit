
{% function get_item(item){ %}
    {% if (item.href && !item.author_url) { %}
        <a href="{%= item.href %}" class="ck-link">{% get_content(item); %}</a>
    {% } else { %}
        <p>{% get_content(item); %}</p>
    {% } %}
{% } %}

{% function get_content(item){ %}

    {% if (item.icon) { %}
    <img src="{%= item.icon %}" class="icon"/>
    {% } %}

    {% if (item.title) { %}
    <strong>{%= item.title %}</strong>
    {% } %}

    {% if (data.style !== 'more') { %}
        {% if (item.author_url) { %}
        <a href="{%= item.author_url %}" class="ck-link">{%= item.author %}</a>
        {% } else if (item.author) { %}
        <span>{%= item.author %}</span>
        {% } %}
        {% if (item.subtitle) { %}
        <span class="subtitle">{%= item.subtitle %}</span>
        {% } %}
    {% } %}

    {% if (item.info) { %}
    <span class="info">{%= item.info %}</span>
    {% } %}

{% } %}


<article class="{%= data.style %}{%= (data.config.plain ? ' plain' : '') %}">

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
        {% if (!item.title) { return; } %}
        <div class="ck-item">
            {% get_item(item); %}
        </div>
    {% }); %}
    </nav>

    {% } else { %}

    <ul class="{%= ('col' + data.config.col) %}">
    {% data.items.forEach(function(item){ %}
        {% if (!item.title && !item.author) { return; } %}
        <li class="ck-item">
            {% get_item(item); %}
            {% if (item.content) { %}
            <span class="content">{%= item.content %}</span>
            {% } %}
            {% if (item.meta) { %}
            <span class="meta">{%= item.meta %}</span>
            {% } %}
        </li>
    {% }); %}
    </ul>

    {% } %}

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>
