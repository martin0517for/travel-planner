/**
 * Flight（航班）資料模型
 *
 * id                string
 * tripId            string   關聯的旅程
 * airline           string   航空公司
 * flightNo          string   航班編號
 * departurePlaceId  string | null  出發地點（引用 Place Library，通常是機場）
 * departureTime     string   datetime-local 格式：YYYY-MM-DDTHH:mm
 * arrivalPlaceId    string | null  抵達地點
 * arrivalTime       string
 * notes             string
 */
export function createFlightDraft(tripId) {
  return {
    tripId,
    airline: "",
    flightNo: "",
    departurePlaceId: null,
    departureTime: "",
    arrivalPlaceId: null,
    arrivalTime: "",
    notes: "",
  };
}
