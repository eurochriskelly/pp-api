/**
 * Format team names for display, handling special team references
 */
function friendlyTeamLabel(team) {
  if (!team) return null;
  if (!team.startsWith('~')) return team;

  try {
    // Parse ~group:X/p:Y format (e.g., "2nd in GP.3")
    if (team.startsWith('~group:')) {
      const match = team.match(/~group:(\d+)\/p:(\d+)/);
      if (match) {
        const groupNumber = match[1];
        const position = parseInt(match[2], 10);
        return getPositionText(position) + ' in GP.' + groupNumber;
      }
    }
    // Parse ~match:XXXXXX/p:Y format (e.g., "Winner of 02" or "Loser of 02")
    else if (team.startsWith('~match:')) {
      const match = team.match(/~match:(\d+)\/p:(\d+)/);
      if (match) {
        const matchNumber = match[1];
        const position = parseInt(match[2], 10);
        // Extract last 2 digits of match number
        const shortMatchNumber = matchNumber.slice(-2);
        return position === 1
          ? 'Winner of ' + shortMatchNumber
          : 'Loser of ' + shortMatchNumber;
      }
    }
    // Parse ~best:X/p:Y format (e.g., "1st-best 2nd-place")
    else if (team.startsWith('~best:')) {
      const match = team.match(/~best:(\d+)\/p:(\d+)/);
      if (match) {
        const bestRank = parseInt(match[1], 10);
        const place = parseInt(match[2], 10);
        return (
          getPositionText(bestRank) +
          '-best ' +
          getPositionText(place) +
          '-place'
        );
      }
    }
    // Parse ~rank:X/p:Y format (e.g., "Rank 1 in GPs")
    else if (team.startsWith('~rank:')) {
      const match = team.match(/~rank:(\d+)\/p:(\d+)/);
      if (match) {
        const rank = parseInt(match[1], 10);
        return 'Rank ' + rank + ' in GPs';
      }
    }
  } catch (e) {
    console.error('Error parsing team label:', e);
  }

  // Fallback: just remove the tilde if no pattern matches
  return team.substring(1);
}

// Helper function to format position numbers with correct ordinal suffix
function getPositionText(position) {
  const lastDigit = position % 10;
  const lastTwoDigits = position % 100;

  // Special case for 11th, 12th, 13th
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return position + 'th';
  }

  if (lastDigit === 1) return position + 'st';
  if (lastDigit === 2) return position + 'nd';
  if (lastDigit === 3) return position + 'rd';
  return position + 'th';
}

module.exports = {
  friendlyTeamLabel,
  getPositionText,
};
