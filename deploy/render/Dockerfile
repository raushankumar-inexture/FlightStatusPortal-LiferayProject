FROM liferay/dxp:2026.q1.0-lts

USER root

COPY --chmod=755 render_entrypoint.sh /usr/local/bin/render_entrypoint.sh

COPY --chown=liferay:liferay portal-ext.properties /mnt/liferay/files/portal-ext.properties
COPY --chown=liferay:liferay client-extensions/ /mnt/liferay/files/osgi/client-extensions/
COPY --chown=liferay:liferay modules/ /mnt/liferay/files/osgi/modules/

ENTRYPOINT ["tini", "--", "/usr/local/bin/render_entrypoint.sh"]
