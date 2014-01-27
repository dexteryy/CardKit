<span class="ck-hd {%= (hdLink && 'clickable' || '') %}">
    {% if (hdLink) { %}
    <a href="{%= hdLink %}" 
        target="{%= (hdLinkTarget || '_self') %}" 
        class="ck-link-mask ck-link"></a>
    {% } %}
    <span>{%= content %}</span>
</span>
