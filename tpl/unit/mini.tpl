
<article>

    {% if (data.hd) { %}
    <header>

        <span class="ck-hd {%= (data.hd_url && 'clickable' || '') %}">
            {% if (data.hd_url) { %}
            <a href="{%= data.hd_url %}" class="ck-link ck-link-mask"></a>
            {% } %}
            <span>{%= data.hd %}</span>
        </span>

        {% if (data.hd_opt) { %}
        <div class="ck-hdopt">{%=data.hd_opt%}</div>
        {% } %}

    </header>
    {% } %}

    <div class="ck-list-wrap">
    {% if (data.items.length) { %}

        <div class="ck-list">
        {% data.items.forEach(function(item, i){ %}
            <div class="ck-item {%= (item.href && 'clickable' || '') %}">

                <div class="ck-initem">

                    {% if (item.href) { %}
                    <a href="{%= item.href %}" class="ck-link ck-link-mask"></a>
                    {% } %}

                    <div class="ck-title-box">

                        {% if (item.icon) { %}
                        <span class="ck-icon">
                            <img src="{%= item.icon %}"/>
                        </span>
                        {% } %}

                        <div class="ck-title-set">

                            {% if (item.title) { %}
                            <div class="ck-title-line">
                                {%= item.titlePrefix %}
                                <span class="ck-title">{%= item.title %}</span>
                                {%= item.titleSuffix %}
                                {%= item.titleTag %}
                            </div>
                            {% } %}

                            {% if (item.info) { %}
                            <div class="ck-info-wrap">
                                {%= item.info %}
                            </div>
                            {% } %}

                            {% if (item.desc) { %}
                            <div class="ck-desc-wrap">
                                {%= item.desc %}
                            </div>
                            {% } %}

                        </div>

                        {% if (item.content) { %}
                        <div class="ck-content-wrap">
                            {%= item.content %}
                        </div>
                        {% } %}

                        {% if (item.meta) { %}
                        <div class="ck-meta-wrap">
                            {%= item.meta %}
                        </div>
                        {% } %}

                    </div>

                    {% if (item.author || item.authorDesc || item.authorMeta) { %}
                    <div class="ck-author-box">

                        {% if (item.avatar) { %}
                            {% if (item.authorUrl) { %}
                            <a href="{%= item.authorUrl %}" class="ck-avatar ck-link">
                                <img src="{%= item.avatar %}"/>
                            </a>
                            {% } else { %}
                            <span class="ck-avatar">
                                <img src="{%= item.avatar %}"/>
                            </span>
                            {% } %}
                        {% } %}

                        <div class="ck-author-line">
                            {%= item.authorPrefix %}
                            {% if (item.authorUrl) { %}
                            <a href="{%= item.authorUrl %}" class="ck-author ck-link">{%= item.author %}</a>
                            {% } else { %}
                            <span class="ck-author">{%= item.author %}</span>
                            {% } %}
                            {%= item.authorSuffix %}
                        </div>

                        {% if (item.authorDesc) { %}
                        <div class="ck-author-desc-wrap">
                            {%= item.authorDesc %}
                        </div>
                        {% } %}

                        {% if (item.authorMeta) { %}
                        <div class="ck-author-meta-wrap">
                            {%= item.authorMeta %}
                        </div>
                        {% } %}


                    </div>
                    {% } %}

                </div>

            </div>
        {% }); %}
        </div>

    {% } else { %}

        <div class="ck-list">
            <div class="ck-item blank">
                <div class="ck-initem">{%=(data.config.blank || '目前还没有内容')%}</div>
            </div>
        </div>

    {% } %}
    </div>

    {% if (data.ft) { %}
    <footer>{%= data.ft %}</footer>
    {% } %}

</article>

