import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import airportCoordinates from "./airports";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const flightPathLayer = {
  id: "flightPathsLayer",
  type: "line",
  source: "flightPaths",
  layout: {
    "line-join": "round",
    "line-cap": "round",
  },
  paint: {
    "line-color": [
      "case",
      ["==", ["get", "progress"], 1],
      "rgba(255, 255, 0, 0.3)", // Low-opacity Yellow for progress === 1, ie. flight has arrived
      "rgba(255, 87, 51, 1)", // Orange for in-progress flights, ie. progress < 1
    ],
    "line-width": 2,
  },
};

const getMappedFlights = (flightData) => {
  return flightData
    .filter(
      (flight) =>
        flight.estDepartureAirport &&
        flight.estArrivalAirport &&
        airportCoordinates[flight.estDepartureAirport] &&
        airportCoordinates[flight.estArrivalAirport]
    )
    .map((flight) => ({
      ...flight,
      departureLatitude:
        airportCoordinates[flight.estDepartureAirport].latitude,
      departureLongitude:
        airportCoordinates[flight.estDepartureAirport].longitude,
      arrivalLatitude: airportCoordinates[flight.estArrivalAirport].latitude,
      arrivalLongitude: airportCoordinates[flight.estArrivalAirport].longitude,
      currentPosition: {
        longitude: airportCoordinates[flight.estDepartureAirport].longitude,
        latitude: airportCoordinates[flight.estDepartureAirport].latitude,
      },
    }));
};

const getFlightPaths = (mappedFlights, currentTime) => {
  return {
    type: "FeatureCollection",
    features: mappedFlights.map((flight) => {
      const flightDuration = flight.lastSeen - flight.firstSeen;

      let progress = (currentTime - flight.firstSeen) / flightDuration;

      if (progress >= 1) {
        progress = 1; // Flight has arrived
      } else if (progress < 0) {
        progress = 0; // Flight has not departed yet
      }

      const interpolatedLng =
        flight.departureLongitude +
        (flight.arrivalLongitude - flight.departureLongitude) * progress;
      const interpolatedLat =
        flight.departureLatitude +
        (flight.arrivalLatitude - flight.departureLatitude) * progress;

      return {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [flight.departureLongitude, flight.departureLatitude],
            [interpolatedLng, interpolatedLat],
          ],
        },
        properties: {
          callsign: flight.callsign,
          departureAirport: flight.estDepartureAirport,
          arrivalAirport: flight.estArrivalAirport,
          departureTime: flight.firstSeen,
          arrivalTime: flight.lastSeen,
          progress: progress,
        },
      };
    }),
  };
};

const Map = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const animationRef = useRef(null);
  const previousTimestampRef = useRef(null); // For managing elapsed time
  const [flights, setFlights] = useState([]);

  const current = Math.floor(Date.now() / 1000); // Current time in UNIX timestamp
  const startTime = current - 7200; // Two hours ago
  const endTime = current;

  const [currentTime, setCurrentTime] = useState(startTime); // To be set after fetching data

  // Animation settings
  const SPEED = 500; // How many seconds to advance per second

  useEffect(() => {
    if (map.current) return;

    // Initialize Mapbox with terrain
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [0, 20], // Adjust as needed
      zoom: 1.5, // Adjust as needed
      pitch: 45,
      bearing: 0,
      antialias: true,
    });

    map.current.on("load", () => {
      fetchFlightData();
    });

    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Fetch flight data for the past 2 hours
  const fetchFlightData = async () => {
    try {
      // Call OpenSky API with time range
      const response = await axios.get(
        `https://opensky-network.org/api/flights/all?begin=${startTime}&end=${current}`
      );

      const flightData = response.data;
      // Map airport codes to coordinates and initialize currentPosition
      const mappedFlights = getMappedFlights(flightData);

      // Store flight data in state
      setFlights(mappedFlights);

      // Convert flight data to GeoJSON for map visualization
      const flightPaths = getFlightPaths(mappedFlights, startTime);

      // Add flight paths to the map
      if (map.current.getSource("flightPaths")) {
        map.current.getSource("flightPaths").setData(flightPaths);
      } else {
        map.current.addSource("flightPaths", {
          type: "geojson",
          data: flightPaths,
        });

        map.current.addLayer(flightPathLayer);

        // Optionally, fit map to flight paths
        if (flightPaths.features.length > 0) {
          const coordinates = flightPaths.features.flatMap(
            (feature) => feature.geometry.coordinates
          );

          const bounds = coordinates.reduce(
            (bounds, coord) => bounds.extend(coord),
            new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
          );

          map.current.fitBounds(bounds, { padding: 50 });
        }
      }

      // Start the animation after data is loaded
      startAnimation();
    } catch (error) {
      console.error("Error fetching flight data:", error);
    }
  };

  useEffect(() => {
    if (flights.length === 0 || currentTime === null) return;

    // Update flight paths based on currentTime
    const updatedFlightPaths = getFlightPaths(flights, currentTime);

    if (map.current.getSource("flightPaths")) {
      map.current.getSource("flightPaths").setData(updatedFlightPaths);
    }
  }, [currentTime, flights]);

  const animateFlightPaths = (timestamp) => {
    if (!previousTimestampRef.current) {
      previousTimestampRef.current = timestamp;
    }
    const delta = timestamp - previousTimestampRef.current;
    previousTimestampRef.current = timestamp;

    // Calculate time increment based on speed and elapsed time
    const timeIncrement = Math.floor((delta * SPEED) / 1000); // Increment in seconds

    if (timeIncrement > 0 && currentTime !== null && endTime !== null) {
      setCurrentTime((prevTime) => {
        const newTime = prevTime + timeIncrement;
        if (newTime >= endTime) {
          cancelAnimationFrame(animationRef.current);
          return endTime;
        }
        return newTime;
      });
    }

    // Continue the animation
    animationRef.current = requestAnimationFrame(animateFlightPaths);
  };

  const startAnimation = () => {
    animationRef.current = requestAnimationFrame(animateFlightPaths);
  };

  const handleSliderChange = (e) => {
    const selectedTime = parseInt(e.target.value, 10);
    setCurrentTime(selectedTime);
  };

  return (
    <div>
      {
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "10px",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            borderRadius: "5px",
            zIndex: 1,
            width: "80%",
          }}
        >
          <input
            type="range"
            min={startTime}
            max={endTime}
            value={currentTime}
            onChange={handleSliderChange}
            style={{ width: "100%" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "5px",
            }}
          >
            <span>{new Date(startTime * 1000).toLocaleTimeString()}</span>
            <span>{new Date(currentTime * 1000).toLocaleTimeString()}</span>
            <span>{new Date(endTime * 1000).toLocaleTimeString()}</span>
          </div>
        </div>
      }
      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
};

export default Map;
