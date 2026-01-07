#!/bin/bash

set -x
set -e

host=$(hostname -s)


crontab -u root -l | grep -v '/var/log/first-backup.log'  | crontab -u root -

. /home/.config/swissbackup/openrc.sh

usage () {
        echo "$0 --folders-to-backup <folder1>[,folder2,folder3,...]"
        exit 1
}
for i in $@ ; do
        case "${1}" in
        "--folders-to-backup"|"-f")
        echo $1
                if [ -z "${2}" ] ; then
                        echo "No parameter defining the --folder-to-backup parameter"
                        usage
                fi
                FOLDER_TO_BACKUP="${2}"
                shift
                shift
        ;;
        *)
        ;;
        esac
done

usage2() {  1>&2; exit 1; }

while getopts "s:h:d:w:m:y:" o; do
    case "${o}" in

        s)
            last_snapshot=${OPTARG}
            ;;


        h)
            hour=${OPTARG}
            ;;
        d)
            day=${OPTARG}
            ;;
        w)
            week=${OPTARG}
            ;;

        m)
            month=${OPTARG}
            ;;

        y)
            year=${OPTARG}
            ;;
    esac
done
shift $((OPTIND-1))

FOLDERS_TO_BACKUP=$(echo ${FOLDER_TO_BACKUP} | tr -d  ' ' | tr  ',' ' ' )

for i in ${FOLDERS_TO_BACKUP}"" ; do


       eval "/usr/bin/restic backup --hostname $host --tag $i $i"
       
       

done

loopOverArray() {
  HOST_FILTER="${HOST_FILTER:-$(hostname -s)}"

  restic snapshots --json \
  | jq -c --arg h "$HOST_FILTER" '.[] | select(.hostname == $h)' \
  | while read -r i; do
      id="$(jq -r '.short_id' <<<"$i")"
      ctime="$(jq -r '.time | split(".")[0]' <<<"$i")"
      paths="$(jq -r '.paths | join(",")' <<<"$i")"
      hostname="$(jq -r '.hostname' <<<"$i")"

      test="$(restic --no-lock stats "$id" | awk 'END{gsub(/%/,"",$3); print $3$4}')"
      size="$test"

      jq -nc \
        --arg id "$id" \
        --arg date "$ctime" \
        --arg size "$size" \
        --arg path "$paths" \
        --arg name "$hostname" \
        '{id:$id, date:$date, size:$size, path:$path, name:$name}'
    done
}

parse() {
  now="$(date +%s)"
  loopOverArray | jq -s --arg now "$now" '{last_update:$now, backup_plan:.}' > /home/plan.json
}

parse
