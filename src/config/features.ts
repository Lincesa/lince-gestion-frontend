/**
 * Trips (Viajes) are switched off until the business decides whether to use
 * them (2026-11-02). Off hides the Logística "Viajes" tab and routes, the
 * field users' Viajes link (transport users land on Mi transporte instead)
 * and the trip picker when a transport user uploads a remito. The pages, API
 * calls and stored tripId stay untouched: set this to true to bring it all
 * back. The driver app has the same switch (kTripsEnabled in lib/core/config.dart).
 */
export const TRIPS_ENABLED = false;

/** Logística tabs without Viajes while trips are off. */
export function logisticaTabs<T extends { to: string }>(tabs: T[], tripsEnabled = TRIPS_ENABLED): T[] {
  return tripsEnabled ? tabs : tabs.filter((tab) => !tab.to.startsWith('/logistica/viajes'));
}
