import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import airportCoordinates from "./airports";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const Map = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const animationRef = useRef(null);
  const currentTimeRef = useRef(Math.floor(Date.now() / 1000)); // Use ref for current time
  const [flights, setFlights] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const previousTimestampRef = useRef(null); // For managing elapsed time

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch flight data for the past hour using begin and end times
  const fetchFlightData = async () => {
    try {
      const currentTime = Math.floor(Date.now() / 1000); // Current time in UNIX timestamp
      const startTime = currentTime - 7200; // Two hours ago

      // Call OpenSky API with time range
      const response = await axios.get(
        `https://opensky-network.org/api/flights/all?begin=${startTime}&end=${currentTime}`
      );

      const flightData = response.data;
      // Map airport codes to coordinates and initialize currentPosition
      const mappedFlights = flightData
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
          arrivalLatitude:
            airportCoordinates[flight.estArrivalAirport].latitude,
          arrivalLongitude:
            airportCoordinates[flight.estArrivalAirport].longitude,
          currentPosition: {
            longitude: airportCoordinates[flight.estDepartureAirport].longitude,
            latitude: airportCoordinates[flight.estDepartureAirport].latitude,
          },
        }));

      // Store flight data in state
      setFlights(mappedFlights);

      // Convert flight data to GeoJSON for map visualization
      const flightPaths = {
        type: "FeatureCollection",
        features: mappedFlights.map((flight) => ({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [flight.departureLongitude, flight.departureLatitude],
              [
                flight.currentPosition.longitude,
                flight.currentPosition.latitude,
              ],
            ],
          },
          properties: {
            callsign: flight.callsign,
            departureAirport: flight.estDepartureAirport,
            arrivalAirport: flight.estArrivalAirport,
            departureTime: flight.firstSeen, // Unix timestamp of departure
            arrivalTime: flight.lastSeen, // Unix timestamp of arrival
          },
        })),
      };

      // Add flight paths to the map
      if (map.current.getSource("flightPaths")) {
        map.current.getSource("flightPaths").setData(flightPaths);
      } else {
        map.current.addSource("flightPaths", {
          type: "geojson",
          data: flightPaths,
        });

        map.current.addLayer({
          id: "flightPathsLayer",
          type: "line",
          source: "flightPaths",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#FF5733", // Orange line
            "line-width": 2,
            "line-opacity": 1, // Always visible
          },
        });

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
    } catch (error) {
      console.error("Error fetching flight data:", error);
    }
  };

  const animateFlightPaths = (timestamp) => {
    if (!previousTimestampRef.current) {
      previousTimestampRef.current = timestamp;
    }
    const delta = timestamp - previousTimestampRef.current;
    previousTimestampRef.current = timestamp;

    // Define speed: how many seconds to advance per millisecond
    const speed = 100; // 1 second per 1000 ms
    const timeIncrement = Math.floor((delta * speed) / 1000); // Increment in seconds

    if (timeIncrement > 0) {
      currentTimeRef.current += timeIncrement;
    }

    // Update flight positions based on currentTimeRef.current
    const updatedFlights = flights.map((flight) => {
      const flightDuration = flight.lastSeen - flight.firstSeen;
      if (flightDuration === 0) return flight; // Avoid division by zero

      const progress =
        (currentTimeRef.current - flight.firstSeen) / (flightDuration * 10);

      if (progress >= 1) {
        return {
          ...flight,
          currentPosition: {
            longitude: flight.arrivalLongitude,
            latitude: flight.arrivalLatitude,
          },
        }; // Flight has arrived
      }

      const interpolatedLng =
        flight.departureLongitude +
        (flight.arrivalLongitude - flight.departureLongitude) * progress;
      const interpolatedLat =
        flight.departureLatitude +
        (flight.arrivalLatitude - flight.departureLatitude) * progress;

      return {
        ...flight,
        currentPosition: {
          longitude: interpolatedLng,
          latitude: interpolatedLat,
        },
      };
    });

    setFlights(updatedFlights);

    // Update the GeoJSON source with updated flight positions
    const flightPaths = {
      type: "FeatureCollection",
      features: updatedFlights.map((flight) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [flight.departureLongitude, flight.departureLatitude],
            [flight.currentPosition.longitude, flight.currentPosition.latitude],
          ],
        },
        properties: {
          callsign: flight.callsign,
          departureAirport: flight.estDepartureAirport,
          arrivalAirport: flight.estArrivalAirport,
          departureTime: flight.firstSeen,
          arrivalTime: flight.lastSeen,
        },
      })),
    };

    if (map.current.getSource("flightPaths")) {
      map.current.getSource("flightPaths").setData(flightPaths);
    }

    // Check if any flights are still in progress
    const anyInProgress = updatedFlights.some(
      (flight) => currentTimeRef.current < flight.lastSeen
    );

    console.log("anyInProgress", anyInProgress);

    // if (anyInProgress) {
    animationRef.current = requestAnimationFrame(animateFlightPaths);
    // } else {
    //   setIsPlaying(false);
    //   cancelAnimationFrame(animationRef.current);
    //   previousTimestampRef.current = null; // Reset for next play
    // }
  };

  const handlePlayButtonClick = () => {
    // if (isPlaying) {
    //   setIsPlaying(false);
    //   cancelAnimationFrame(animationRef.current);
    //   previousTimestampRef.current = null; // Reset
    // } else {
    setIsPlaying(true);
    currentTimeRef.current = Math.floor(Date.now() / 1000); // Reset current time to now or set to flight's start time
    animationRef.current = requestAnimationFrame(animateFlightPaths); // Start the animation
    // }
  };

  return (
    <div>
      <button
        onClick={handlePlayButtonClick}
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          padding: "10px 20px",
          fontSize: "16px",
          backgroundColor: "#FF5733",
          color: "white",
          border: "none",
          borderRadius: "5px",
          zIndex: 1, // Ensure button is above map
          cursor: "pointer",
        }}
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
};

export default Map;
