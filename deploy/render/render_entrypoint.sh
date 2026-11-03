#!/bin/bash

# Render gives the database settings as plain values; Liferay wants a JDBC URL.
export LIFERAY_JDBC_PERIOD_DEFAULT_PERIOD_DRIVER_UPPERCASEC_LASS_UPPERCASEN_AME=org.postgresql.Driver
export LIFERAY_JDBC_PERIOD_DEFAULT_PERIOD_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}"
export LIFERAY_JDBC_PERIOD_DEFAULT_PERIOD_USERNAME="${DB_USER}"
export LIFERAY_JDBC_PERIOD_DEFAULT_PERIOD_PASSWORD="${DB_PASSWORD}"

# Enable the MFA modules shipped with DXP so the custom checker can resolve.
mfa_bundle_count=0
for bundle in /opt/liferay/osgi/portal/com.liferay.multi.factor.authentication*.jar; do
	if [ ! -f "$bundle" ]; then
		echo "Liferay MFA bundles are missing from /opt/liferay/osgi/portal." >&2
		exit 1
	fi

	cp "$bundle" /opt/liferay/osgi/modules/
	mfa_bundle_count=$((mfa_bundle_count + 1))
done

echo "Staged ${mfa_bundle_count} Liferay MFA bundles."

# A Render disk is mounted as root, so give the data folder back to Liferay.
mkdir -p /opt/liferay/data
chown -R liferay:liferay /opt/liferay/data

exec runuser -u liferay -- /usr/local/bin/liferay_entrypoint.sh "$@"
