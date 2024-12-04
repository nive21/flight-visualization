import airportCoordinates from "../data/airports";

export const NUM_WAYPOINTS = 100;

export function calculateBearing(from, to) {
  const [lon1, lat1] = from.map((deg) => (deg * Math.PI) / 180);
  const [lon2, lat2] = to.map((deg) => (deg * Math.PI) / 180);

  const deltaLon = lon2 - lon1;
  const x = Math.sin(deltaLon) * Math.cos(lat2);
  const y =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearing = (Math.atan2(x, y) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export const getLocationLayer = (validFlights, color, type) => ({
  id: type,
  data: validFlights,
  getPosition: (d) => {
    const location = airportCoordinates[d?.[type].icao];
    return [location.longitude, location.latitude];
  },
  getFillColor: color,
  getRadius: 50000, // in meters
  opacity: 0.8,
  radiusMinPixels: 5,
  radiusMaxPixels: 10,
  pickable: true,
});

export const getFlightsWithLocations = (flights) => {
  return flights
    .map((flight) => {
      const departureAirport = airportCoordinates?.[flight.departure.icao];
      const arrivalAirport = airportCoordinates?.[flight.arrival.icao];

      // Get the coordinates of the departure and arrival airports
      const { longitude: departureLongitude, latitude: departureLatitude } =
        departureAirport;
      const { longitude: arrivalLongitude, latitude: arrivalLatitude } =
        arrivalAirport;

      const from = [departureLongitude, departureLatitude];
      const to = [arrivalLongitude, arrivalLatitude];

      const waypoints = generateArcPoints(from, to, NUM_WAYPOINTS);

      // Calculate the progress of the flight
      const departureTime = Math.floor(
        new Date(flight.departure.estimated).getTime() / 1000
      );
      const arrivalTime = Math.floor(
        new Date(flight.arrival.estimated).getTime() / 1000
      );
      const flightDuration = arrivalTime - departureTime;

      // The API sometimes returns incorrect timestamps where arrival time is before the departure time
      if (arrivalTime <= departureTime) return null;

      return {
        ...flight,
        waypoints,
        departureTime,
        arrivalTime,
        flightDuration,
      };
    })
    .filter((flightData) => flightData);
};

// Function to interpolate positions along the great circle path
function interpolateGreatCircle(from, to, fraction) {
  const [lon1, lat1] = from.map((deg) => (deg * Math.PI) / 180);
  const [lon2, lat2] = to.map((deg) => (deg * Math.PI) / 180);

  const deltaLat = lat2 - lat1;
  const deltaLon = lon2 - lon1;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  const deltaSigma = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (deltaSigma === 0) {
    return from;
  }

  const A = Math.sin((1 - fraction) * deltaSigma) / Math.sin(deltaSigma);
  const B = Math.sin(fraction * deltaSigma) / Math.sin(deltaSigma);

  const x =
    A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y =
    A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  const lat = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2));
  const lon = Math.atan2(y, x);

  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

// Function to generate points along the arc
function generateArcPoints(from, to, numPoints = 100) {
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    const interpolatedPoint = interpolateGreatCircle(from, to, fraction);
    points.push({
      position: interpolatedPoint,
    });
  }
  return points;
}
