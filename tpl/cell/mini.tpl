
<article class="{%= data.style %}">

    {% if (data.hd) { %}
    <header>
        {% if (data.hd_url) { %}
        <a href="{%= data.hd_url %}" class="ck-link">{%= data.hd %}</a>
        {% } else { %}
        <span>{%= data.hd %}</span>
        {% } %}
    </header>
    {% } %}

    {% if (data.style === 'slide') { %}
    <div class="wrapper">
    {% } %}

        {% data.items.forEach(function(item){ %}
        <section>
            <div class="content">{%= item.content %}</div>
            {% if (item.title || item.author) { %}
            <p>
                {% if (item.icon) { %}
                <img src="{%= item.icon %}" class="icon"/>
                {% } %}
                <strong>{%= item.title %}</strong>
                {% if (item.author_url) { %}
                <a href="{%= item.author_url %}" class="ck-link">{%= item.author %}</a>
                {% } else if (item.author) { %}
                <span>{%= item.author %}</span>
                {% } %}
                {% if (item.subtitle) { %}
                <span class="subtitle">{%= item.subtitle %}</span>
                {% } %}
                {% if (item.info) { %}
                <span class="info">{%= item.info %}</span>
                {% } %}
                {% if (item.opt) { %}
                <span class="opt">{%= item.opt %}</span>
                {% } %}
            </p>
            {% } %}
        </section>
        {% }); %}

    {% if (data.style === 'slide') { %}
    </div>
    <footer>
        {% if (data.items.length > 1) { %}
        <div class="page">
        {% data.items.forEach(function(){ %}
            <span></span>
        {% }); %}
        </div>
        {% } %}
    </footer>
    {% } %}

</article>

