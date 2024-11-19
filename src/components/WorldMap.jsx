import { useCallback, useEffect, useRef, useState } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import airportCoordinates from "../data/airports";
import { ScenegraphLayer } from "@deck.gl/mesh-layers";

import { Map } from "react-map-gl";
import DeckGL from "@deck.gl/react";
import { rawFlightData } from "../data/flightData";
import TimeSlider from "./TimeSlider";
import airplane from "../assets/airplane.glb";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const INITIAL_VIEW_STATE = {
  longitude: 0,
  latitude: 20,
  zoom: 1.5,
  pitch: 0,
  bearing: 0,
};
const ACCENT_COLOR_1 = [128, 0, 128];
const ACCENT_COLOR_2 = [46, 139, 87];
const NUM_WAYPOINTS = 100;

function calculateBearing(from, to) {
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

const getLocationLayer = (validFlights, color, type) => ({
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

const getFlightsWithLocations = (flights) => {
  return flights.map((flight) => {
    const { longitude: departureLongitude, latitude: departureLatitude } =
      airportCoordinates[flight.departure.icao];
    const { longitude: arrivalLongitude, latitude: arrivalLatitude } =
      airportCoordinates[flight.arrival.icao];

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
    return {
      ...flight,
      waypoints,
      departureTime,
      arrivalTime,
      flightDuration,
    };
  });
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

const WorldMap = () => {
  const animationRef = useRef(null);

  const [flights, setFlights] = useState([]);
  const [layers, setLayers] = useState([]);
  const [tooltipInfo, setTooltipInfo] = useState(null);

  // Time management
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const startTime = currentTimestamp - 86400; // Past 24 hours
  const endTime = currentTimestamp;

  const [currentTime, setCurrentTime] = useState(startTime);
  const [isPlaying, setIsPlaying] = useState(false);

  const SPEED = 10000; // Number of seconds per real-time second

  useEffect(() => {
    fetchFlightData();
  }, []);

  const fetchFlightData = async () => {
    try {
      // TODO: get flights from the past 24 hours for a city
      // const response = await fetchFlightsFromAPI();

      const validFlights = rawFlightData.data.filter((flight) => {
        const dep = airportCoordinates[flight.departure.icao];
        const arr = airportCoordinates[flight.arrival.icao];
        return dep && arr;
      });
      const updatedFlights = getFlightsWithLocations(validFlights);

      setFlights(updatedFlights);
    } catch (error) {
      console.error("Error fetching flight data:", error);
    }
  };

  useEffect(() => {
    if (flights.length === 0) return;

    // Create tooltip that displays on hover of the arc and locations
    const tooltip = {
      highlightColor: [255, 255, 0, 128],
      onHover: ({ object, x, y }) => {
        const tooltip = object
          ? `${object.departure.airport} → ${object.arrival.airport}`
          : null;
        setTooltipInfo(tooltip ? { text: tooltip, x, y } : null);
      },
    };

    // Create ScatterplotLayer for departure airports
    const depLayer = new ScatterplotLayer({
      ...getLocationLayer(flights, ACCENT_COLOR_1, "departure"),
      ...tooltip,
    });

    // Create ScatterplotLayer for arrival airports
    const arrLayer = new ScatterplotLayer({
      ...getLocationLayer(flights, ACCENT_COLOR_2, "arrival"),
      ...tooltip,
    });

    const arcLayer = new ScatterplotLayer({
      id: "flight-path-scatter",
      data: flights.flatMap((flight) => {
        let progress =
          (currentTime - flight.departureTime) / flight.flightDuration;

        if (progress >= 1) {
          progress = 1;
        } else if (progress <= 0) {
          progress = 0;
        }

        // Slice the waypoints array based on progress
        const numWaypointsToShow = Math.floor(progress * NUM_WAYPOINTS);
        return flight.waypoints.slice(0, numWaypointsToShow) || [];
      }),
      getPosition: (d) => d.position,
      getFillColor: [255, 255, 0],
      getRadius: 10000,
      pickable: false,
    });

    const airplaneLayer = new ScenegraphLayer({
      id: "airplane-layer",
      data: flights.flatMap((flight) => {
        let progress =
          (currentTime - flight.departureTime) / flight.flightDuration;

        if (progress >= 1) {
          progress = 1;
        } else if (progress <= 0) {
          progress = 0;
        }

        // Slice the waypoints array based on progress
        const numWaypointsToShow = Math.floor(progress * NUM_WAYPOINTS);
        return (
          {
            ...flight.waypoints?.[numWaypointsToShow - 1],
            previousPosition:
              flight.waypoints?.[numWaypointsToShow - 2]?.position,
          } || []
        );
      }),
      pickable: false,
      getPosition: (d) => d.position,
      scenegraph: airplane,
      getOrientation: (d) => {
        const { position, previousPosition } = d;
        if (position && previousPosition) {
          const bearing = calculateBearing(previousPosition, position);
          return [0, -bearing, 90];
        }
        return [0, 0, 90];
      },
      sizeScale: 500,
      _lighting: "pbr",
    });

    setLayers([arcLayer, depLayer, arrLayer, airplaneLayer]);
  }, [flights, currentTime]);

  const animateTime = useCallback(() => {
    setCurrentTime((prevTime) => {
      const newTime = prevTime + SPEED / 60;
      if (newTime >= endTime) {
        setIsPlaying(false);
        return endTime;
      }
      return newTime;
    });
    animationRef.current = requestAnimationFrame(animateTime);
  }, [endTime]);

  // Animation functions
  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animateTime);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animateTime, isPlaying]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleTimeChange = (e) => {
    const selectedTime = parseInt(e.target.value, 10);
    setCurrentTime(selectedTime);
    setIsPlaying(false); // Pause the animation when slider is moved
  };

  return (
    <div>
      <TimeSlider
        startTime={startTime}
        endTime={endTime}
        currentTime={currentTime}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onTimeChange={handleTimeChange}
      />
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          overflow: "clip",
        }}
      >
        <Map
          mapStyle="mapbox://styles/mapbox/dark-v10"
          mapboxApiAccessToken={MAPBOX_TOKEN}
        />
      </DeckGL>
      {tooltipInfo && (
        <div
          style={{
            position: "absolute",
            zIndex: 1,
            pointerEvents: "none",
            left: tooltipInfo.x,
            top: tooltipInfo.y,
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            padding: "5px",
            borderRadius: "3px",
            fontSize: "12px",
          }}
        >
          {tooltipInfo.text}
        </div>
      )}
    </div>
  );
};

export default WorldMap;
