#!/bin/bash

# Get DB credentials first
envfile="../gaelic-cup-planner/gg_env.sh"
if [ -f "$envfile" ];then
  source "$envfile"
else
  echo "Env file [$envfile] not found" 
  read -p "Enter MySQL username: " GG_USR
  read -s -p "Enter MySQL password: " GG_PWD
  echo
fi

MYSQL="mysql -u$GG_USR -p$GG_PWD -N -B -e"

# Get tournament ID
read -p "Enter tournamentId: " TOURNAMENT_ID

# Query and display tournament info
echo -e "\nFetching tournament details..."
EURO_INFO=$($MYSQL "SELECT id, Date, Title, Location FROM EuroTourno.tournaments WHERE id = $TOURNAMENT_ID;" EuroTourno)
ACC_INFO=$($MYSQL "SELECT id, Date, Title, Location FROM AccTourno.tournaments WHERE id = $TOURNAMENT_ID;" AccTourno)

echo -e "\nTournament Details:"
echo "-------------------"
echo -e "EuroTourno:\n$EURO_INFO"
echo -e "\nAccTourno:\n$ACC_INFO"
echo "-------------------"

# Get confirmation
read -p "Do you want to proceed with transferring fixtures? (y/n): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Aborting transfer."
  exit 0
fi

LOG_FILE="sync_fixtures_$(date +%F_%T).log"
echo "Starting sync at $(date)" | tee -a "$LOG_FILE"

echo "Disabling foreign key checks..." | tee -a "$LOG_FILE"
$MYSQL "SET FOREIGN_KEY_CHECKS=0;" AccTourno

echo "Deleting old entries from AccTourno.fixtures..." | tee -a "$LOG_FILE"
$MYSQL "DELETE FROM AccTourno.fixtures WHERE tournamentId = $TOURNAMENT_ID;" AccTourno

echo "Copying entries from EuroTourno.fixtures..." | tee -a "$LOG_FILE"
$MYSQL "
INSERT INTO AccTourno.fixtures (
  tournamentId, category, groupNumber, stage, pitchPlanned, pitch,
  scheduledPlanned, scheduled, started, ended, team1Planned, team1Id,
  goals1, goals1Extra, goals1Penalties, points1, points1Extra,
  team2Planned, team2Id, goals2, goals2Extra, goals2Penalties,
  points2, points2Extra, umpireTeamPlanned, umpireTeamId, notes, outcome
)
SELECT 
  tournamentId, category, groupNumber, stage, pitchPlanned, pitch,
  scheduledPlanned, scheduled, started, ended, team1Planned, team1Id,
  goals1, goals1Extra, goals1Penalties, points1, points1Extra,
  team2Planned, team2Id, goals2, goals2Extra, goals2Penalties,
  points2, points2Extra, umpireTeamPlanned, umpireTeamId, notes, outcome
FROM EuroTourno.fixtures
WHERE tournamentId = $TOURNAMENT_ID;" AccTourno

echo "Re-enabling foreign key checks..." | tee -a "$LOG_FILE"
$MYSQL "SET FOREIGN_KEY_CHECKS=1;" AccTourno

echo "Sync complete at $(date)" | tee -a "$LOG_FILE"

