<div class="ck-item {%= (itemLink && 'clickable' || '') %}  {%= state.customClass %}" 
        style="width:{%= (context.state.col ? Math.floor(1000/context.state.col)/10 + '%' : '') %};">

    <div class="ck-initem">

        {% if (itemLink && !isItemLinkAlone) { %}
        <a href="{%= itemLink %}" 
            target="{%= (itemLinkTarget || '_self') %}"
            class="ck-link-mask ck-link"></a>
        {% } %}

        <div class="ck-title-box">

            {%= component.opt.join('') %}
            {%= component.icon %}

            <div class="ck-title-set">

                {% if (itemContent) { %}
                <div class="ck-title-line">
                    {%= component.titlePrefix.join('') %}
                    {%= itemContent %}
                    {%= component.titleSuffix.join('') %}
                    {%= component.titleTag.join('') %}
                </div>
                {% } %}

                {% if (component.info.length) { %}
                <div class="ck-info-wrap">
                    {%= component.info.join('') %}
                </div>
                {% } %}

                {% if (component.desc.length) { %}
                <div class="ck-desc-wrap">
                    {%= component.desc.join('') %}
                </div>
                {% } %}

            </div>

            {% if (component.content.length) { %}
            <div class="ck-content-wrap">
                {%= component.content.join('') %}
            </div>
            {% } %}

            {% if (component.meta.length) { %}
            <div class="ck-meta-wrap">
                {%= component.meta.join('') %}
            </div>
            {% } %}

        </div>

        {% if (component.author || component.authorDesc.length || component.authorMeta.length) { %}
        <div class="ck-author-box">

            {%= component.avatar %}

            <div class="ck-author-set">

                <div class="ck-author-line">
                    {%= component.authorPrefix.join('') %}
                    {%= component.author %}
                    {%= component.authorSuffix.join('') %}
                </div>

                {% if (component.authorInfo.length) { %}
                <div class="ck-author-info-wrap">
                    {%= component.authorInfo.join('') %}
                </div>
                {% } %}

                {% if (component.authorDesc.length) { %}
                <div class="ck-author-desc-wrap">
                    {%= component.authorDesc.join('') %}
                </div>
                {% } %}

            </div>

            {% if (component.authorMeta.length) { %}
            <div class="ck-author-meta-wrap">
                {%= component.authorMeta.join('') %}
            </div>
            {% } %}

        </div>
        {% } %}

    </div>

</div>

