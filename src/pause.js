// Volunteer pause (VG spec 2026-10-27-volunteer-pause §4.1). All dates are civil
// 'YYYY-MM-DD' strings, compared lexically; never construct a Date from them.

function easternToday(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

function covers(start, end, d) {
  return (start == null || start <= d) && (end == null || end >= d)
}

// scope 'all': today is covered. scope 'window': the request's service date is
// covered. No scope (no pause row): never suppressed.
function pauseSuppressesOpen({ pauseStartDate, pauseEndDate, pauseScope }, { today, serviceDate }) {
  if (pauseScope === 'all') return covers(pauseStartDate, pauseEndDate, today)
  if (pauseScope === 'window') return covers(pauseStartDate, pauseEndDate, serviceDate)
  return false
}

module.exports = { easternToday, pauseSuppressesOpen }
