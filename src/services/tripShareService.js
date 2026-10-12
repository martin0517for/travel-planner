import { tripRepository } from "../data/repositories/tripRepository.js";
import { placeRepository } from "../data/repositories/placeRepository.js";
import { flightRepository } from "../data/repositories/flightRepository.js";
import { accommodationRepository } from "../data/repositories/accommodationRepository.js";
import { dayPlanRepository } from "../data/repositories/dayPlanRepository.js";
import { checklistRepository } from "../data/repositories/checklistRepository.js";

/**
 * 純前端、沒有伺服器，所以「分享」的做法是：把一趟旅程（含關聯的航班、住宿、
 * 每日行程、用到的地點）打包成一個 JSON 檔案，對方用同一個 App 匯入，
 * 會在他的裝置上建立一趟一模一樣的新旅程（跟原本的旅程各自獨立，互不影響）。
 * 清單內容（行李／記事本／必買）是否包含由分享時的選項決定，預設不包含。
 */
export const tripShareService = {
  buildSharePayload(tripId, { includeChecklists = false } = {}) {
    const trip = tripRepository.getById(tripId);
    if (!trip) return null;

    const flights = flightRepository.getByTrip(tripId);
    const accommodations = accommodationRepository.getByTrip(tripId);
    const dayPlans = dayPlanRepository.getByTrip(tripId);
    const checklistItems = includeChecklists ? checklistRepository.getByTrip(tripId) : [];

    const placeIds = new Set();
    flights.forEach((f) => {
      if (f.departurePlaceId) placeIds.add(f.departurePlaceId);
      if (f.arrivalPlaceId) placeIds.add(f.arrivalPlaceId);
    });
    accommodations.forEach((a) => {
      if (a.placeId) placeIds.add(a.placeId);
    });
    dayPlans.forEach((d) => (d.items || []).forEach((it) => it.placeId && placeIds.add(it.placeId)));
    checklistItems.forEach((c) => c.placeId && placeIds.add(c.placeId));

    const places = placeRepository.getAll().filter((p) => placeIds.has(p.id));

    return {
      app: "travel-planner",
      type: "trip-share",
      version: 1,
      exportedAt: new Date().toISOString(),
      includesChecklists: includeChecklists,
      trip: stripMeta(trip),
      places: places.map(stripMeta),
      flights: flights.map(stripMeta),
      accommodations: accommodations.map(stripMeta),
      dayPlans: dayPlans.map(stripMeta),
      checklistItems: checklistItems.map(stripMeta),
    };
  },

  /** 匯入分享檔：一律在這台裝置上建立一趟全新的旅程，不會覆蓋任何既有資料 */
  importSharePayload(payload) {
    if (!payload || payload.type !== "trip-share" || !payload.trip) {
      return { ok: false, errors: ["這不是有效的旅程分享檔"] };
    }

    const placeIdMap = new Map();
    (payload.places || []).forEach((p) => {
      const { id, ...rest } = p;
      const created = placeRepository.create(rest);
      placeIdMap.set(id, created.id);
    });

    const remap = (oldId) => (oldId && placeIdMap.has(oldId) ? placeIdMap.get(oldId) : null);

    const newTrip = tripRepository.create({
      name: payload.trip.name,
      destination: payload.trip.destination,
      startDate: payload.trip.startDate,
      endDate: payload.trip.endDate,
    });

    (payload.flights || []).forEach((f) => {
      flightRepository.create({
        tripId: newTrip.id,
        airline: f.airline,
        flightNo: f.flightNo,
        departurePlaceId: remap(f.departurePlaceId),
        departureTime: f.departureTime,
        arrivalPlaceId: remap(f.arrivalPlaceId),
        arrivalTime: f.arrivalTime,
        notes: f.notes || "",
      });
    });

    (payload.accommodations || []).forEach((a) => {
      accommodationRepository.create({
        tripId: newTrip.id,
        placeId: remap(a.placeId),
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        confirmationNo: a.confirmationNo || "",
        notes: a.notes || "",
      });
    });

    (payload.dayPlans || []).forEach((d) => {
      dayPlanRepository.create({
        tripId: newTrip.id,
        date: d.date,
        items: (d.items || []).map((it) => ({ ...it, placeId: remap(it.placeId) })),
      });
    });

    (payload.checklistItems || []).forEach((c) => {
      checklistRepository.create({
        tripId: newTrip.id,
        listType: c.listType,
        text: c.text,
        isDone: false,
        placeId: remap(c.placeId),
        notes: c.notes || "",
      });
    });

    return { ok: true, trip: newTrip };
  },
};

function stripMeta(record) {
  const { createdAt, updatedAt, ...rest } = record;
  return rest;
}
