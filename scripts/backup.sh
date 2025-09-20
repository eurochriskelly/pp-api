#!/bin/bash
# switch to top git folder

cd $(git rev-parse --show-toplevel)
if [ ! -f "./pp_env.sh" ];then
  echo "missing env file"
  exit 1
fi
source ./pp_env.sh
today=$(date +"%Y%m%dT%H%M")
bkpdir=backups/${today}

echo "$PP_PWD"
mkdir -p $bkpdir

mysqldump -u root -p"$PP_PWD" EuroTourno > ${bkpdir}/production-backup-${today}.sql
mysqldump -u root -p"$PP_PWD" AccTourno > ${bkpdir}/acceptance-backup-${today}.sql
mysqldump -u root -p"$PP_PWD" --no-data --skip-comments --compact --skip-add-drop-table --skip-tz-utc EuroTourno > ${bkpdir}/production-schema-${today}.sql
mysqldump -u root -p"$PP_PWD" --no-data --skip-comments --compact --skip-add-drop-table --skip-tz-utc AccTourno > ${bkpdir}/acceptance-schema-${today}.sql
echo "Backups and schemas in backups/$today"

