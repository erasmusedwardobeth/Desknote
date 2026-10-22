//! util.rs — tiny helpers used in several places.

/// The current time as an ISO-8601 UTC string, e.g. "2026-10-19T09:30:00.123Z".
/// Used for the `created`, `updated` and `completed_at` columns.
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
