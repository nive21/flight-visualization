import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import airportCoordinates from "./data/airports";
import { rawflightData } from "./flightData";
import airplane from "./assets/airplane.png";

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
  return flightData.map((flight) => {
    // Get airport codes
    const departureAirport = flight.departure.icao;
    const arrivalAirport = flight.arrival.icao;
    // Get coordinates
    const departureCoordinates = airportCoordinates?.[departureAirport];
    const arrivalCoordinates = airportCoordinates?.[arrivalAirport];

    if (!departureCoordinates || !arrivalCoordinates) {
      return null;
    }

    return {
      ...flight,
      departureLatitude: departureCoordinates.latitude,
      departureLongitude: departureCoordinates.longitude,
      arrivalLatitude: arrivalCoordinates.latitude,
      arrivalLongitude: arrivalCoordinates.longitude,
    };
  });
};

const getFlightPaths = (mappedFlights, currentTime) => {
  return {
    type: "FeatureCollection",
    features: mappedFlights.map((flight) => {
      // Parse ISO datetime strings to UNIX timestamps (in seconds)
      const departureTime = Math.floor(
        new Date(flight.departure.estimated).getTime() / 1000
      );
      const arrivalTime = Math.floor(
        new Date(flight.arrival.estimated).getTime() / 1000
      );

      const flightDuration = arrivalTime - departureTime;
      let progress = (currentTime - departureTime) / flightDuration;

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
          departureTime: departureTime, // In UNIX timestamp
          arrivalTime: arrivalTime, // In UNIX timestamp
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
      style: "mapbox://styles/nivedhitha/cm3kr8moy008w01sqbthe8t92",
      center: [0, 20],
      zoom: 1.5,
      pitch: 45,
      bearing: 0,
      antialias: true,
    });

    map.current.on("load", () => {
      // Add the airplane image to the map
      map.current.loadImage(airplane, (error, image) => {
        if (error) {
          console.error("Error loading airplane image:", error);
          return;
        }
        // Add the image with the name 'airplane'
        if (!map.current.hasImage("airplane")) {
          map.current.addImage("airplane", image);
        }

        // Add flight paths and airplane sources/layers
        fetchFlightData();

        // Add the airplane positions source
        map.current.addSource("airplanes", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [], // Initially empty
          },
        });

        // Add the airplane symbol layer
        map.current.addLayer({
          id: "airplanesLayer",
          type: "symbol",
          source: "airplanes",
          layout: {
            "icon-image": "airplane",
            "icon-size": 0.08,
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
      });

      // Cleanup on unmount
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (map.current) {
          map.current.remove();
        }
      };
    });
  }, []);

  // Fetch flight data for the past 2 hours
  const fetchFlightData = async () => {
    try {
      // Call Aviation Stack API with flight status active filter
      // const response = await axios.get(
      //   `https://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATION_STACK_ACCESS_KEY}&flight_status=active`
      // );
      const response = rawflightData;
      const flightData = response.data;
      // Map airport codes to coordinates and initialize currentPosition
      const validFlights = getMappedFlights(flightData)?.filter(
        (flight) => flight
      );

      // Store flight data in state
      setFlights(validFlights);

      // Convert flight data to GeoJSON for map visualization
      const flightPaths = getFlightPaths(validFlights, startTime);

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

      // Initialize airplane positions
      updateAirplanePositions(validFlights, startTime);

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

    // Update airplane positions
    updateAirplanePositions(flights, currentTime);
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

  /**
   * Updates the airplane positions on the map based on the current time.
   * @param {Array} flights - The array of flight objects.
   * @param {number} currentTime - The current UNIX timestamp.
   */
  const updateAirplanePositions = (flights, currentTime) => {
    const airplaneFeatures = flights.map((flight) => {
      // Parse ISO datetime strings to UNIX timestamps (in seconds)
      const departureTime = Math.floor(
        new Date(flight.departure.estimated).getTime() / 1000
      );
      const arrivalTime = Math.floor(
        new Date(flight.arrival.estimated).getTime() / 1000
      );

      const flightDuration = arrivalTime - departureTime;
      let progress = (currentTime - departureTime) / flightDuration;

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
          type: "Point",
          coordinates: [interpolatedLng, interpolatedLat],
        },
        properties: {
          progress: progress,
          flightId: flight.id, // Assuming each flight has a unique ID
        },
      };
    });

    const airplanesGeoJSON = {
      type: "FeatureCollection",
      features: airplaneFeatures,
    };

    if (map.current.getSource("airplanes")) {
      map.current.getSource("airplanes").setData(airplanesGeoJSON);
    }
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
            width: "40%",
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
            <span>2 hrs ago</span>
            <span>Now</span>
          </div>
        </div>
      }
      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
};

export default Map;
