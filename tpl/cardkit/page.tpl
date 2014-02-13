
<div class="ck-page-card{%= !hasHeader ? ' no-header' : '' %}{%= !component.banner || componentData.banner.isBlank ? '' : ' with-banner' %}{%= state.isPageActive === 'true' ? ' topbar-enabled' : '' %}" 
        data-style="{%= state.subtype %}"
        data-page-active="{%= state.isPageActive || 'false' %}"
        data-deck-active="{%= state.isDeckActive || 'false' %}"
        data-deck="{%= (state.deck || 'main') %}"
        data-curdeck="{%= state.currentDeck %}"
        data-cardid="{%= state.cardId %}">

    {% if (hasHeader) { %}
    <div class="ck-header">
        {%= component.nav %}
        {%= component.title %}
        {%= component.actionbar %}
    </div>
    {% } %}

    {%= component.banner %}

    <div class="ck-article">
        {% if (!isBlank) { %}
            {%= content %}
        {% } else { %}
            <div class="ck-blank-card">
                <article class="ck-card-wrap">
                    {% if (component.blank) { %}
                        {%= component.blank %}
                    {% } else { %}
                        <div>{%=(state.blankText || '目前还没有内容')%}</div>
                    {% } %}
                </article>
            </div>
        {% } %}
    </div>

    {% if (component.footer) { %}
    <div class="ck-footer">{%= component.footer %}</div>
    {% } %}

    <a class="ck-page-link-mask ck-link" href="#{%= state.cardId %}"></a>

</div>

