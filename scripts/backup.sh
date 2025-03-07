#!/bin/bash
# switch to top git folder

cd $(git rev-parse --show-toplevel)
source ./gcp_env.sh
today=$(date +"%Y%m%dT%H%M")
bkpdir=backups/${today}
mkdir $bkpdir 

echo "gggg $GCP_MYSQL_ROOT"

mysqldump -u root -p"$GCP_MYSQL_ROOT" EuroTourno > ${bkpdir}/production-backup-${today}.sql
mysqldump -u root -p"$GCP_MYSQL_ROOT" AccTourno > ${bkpdir}/acceptance-backup-${today}.sql
mysqldump -u root -p"$GCP_MYSQL_ROOT" --no-data --skip-comments --compact --skip-add-drop-table --skip-tz-utc EuroTourno > ${bkpdir}/production-schema-${today}.sql
mysqldump -u root -p"$GCP_MYSQL_ROOT" --no-data --skip-comments --compact --skip-add-drop-table --skip-tz-utc AccTourno > ${bkpdir}/acceptance-schema-${today}.sql
echo "Backups and schemas in backups/$today"

