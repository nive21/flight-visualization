import { useCallback, useEffect, useRef, useState } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { ScenegraphLayer } from "@deck.gl/mesh-layers";

import { Map } from "react-map-gl";
import DeckGL from "@deck.gl/react";
import TimeSlider from "./TimeSlider";
import airplane from "../assets/airplane.glb";
import {
  calculateBearing,
  getFlightsWithLocations,
  getLocationLayer,
  NUM_WAYPOINTS,
} from "../utility/helperFunctions";
import { createClient } from "@supabase/supabase-js";
import airportCoordinates from "../data/airports";
import styles from "../styles/Map.module.scss";

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

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const WorldMap = () => {
  const animationRef = useRef(null);

  const [flights, setFlights] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [layers, setLayers] = useState([]);
  const [tooltipInfo, setTooltipInfo] = useState(null);

  // Time management
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(startTime);

  const [isPlaying, setIsPlaying] = useState(false);
  const [title, setTitle] = useState("recently delayed flights...");

  const SPEED = 10000; // Number of seconds per real-time second

  useEffect(() => {
    const fetchFlightData = async () => {
      try {
        setIsLoading(true);

        // Get the latest delayed flights
        const { data, error } = await supabase
          .from("diverted_flights")
          .select("data")
          .order("flight_date", { ascending: false })
          .limit(1)
          .single();

        if (error) throw new Error("No flight data found");

        const validFlights = data.data.filter(
          (flight) =>
            flight.departure.icao &&
            flight.arrival.icao &&
            airportCoordinates[flight.departure.icao] &&
            airportCoordinates[flight.arrival.icao]
        );

        const updatedFlights = getFlightsWithLocations(validFlights);

        if (!updatedFlights) throw new Error("Data not found!");

        // Set the start and end time
        const minTime = Math.min(
          ...updatedFlights.map((flight) => flight.departureTime)
        );
        const maxTime = Math.max(
          ...updatedFlights.map((flight) => flight.arrivalTime)
        );

        setStartTime(minTime);
        setCurrentTime(minTime);
        setEndTime(maxTime);

        // Update the flights
        setFlights(updatedFlights);
        setIsPlaying(true);

        // Hide the title after 2 seconds
        setTimeout(() => {
          setTitle("");
        }, 2000);
      } catch (error) {
        setTitle("Oops! Data not found!");
        console.error("Error fetching flight data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlightData();
  }, []);

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

    // Displays the path
    const arcLayer = new ScatterplotLayer({
      id: "flight-path-scatter",
      data: flights.flatMap((flight) => {
        let progress =
          (currentTime - flight.departureTime) / flight.flightDuration;

        if (progress >= 1) {
          return [];
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

    // Displays the icon of the airplane
    const airplaneLayer = new ScenegraphLayer({
      id: "airplane-layer",
      data: flights.flatMap((flight) => {
        let progress =
          (currentTime - flight.departureTime) / flight.flightDuration;

        if (progress >= 1) {
          return [];
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

    setLayers([depLayer, arrLayer, airplaneLayer, arcLayer]);
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
      <div className={styles.title}>
        <h1>{title}</h1>
      </div>
      {!isLoading && flights?.length && (
        <TimeSlider
          startTime={startTime}
          endTime={endTime}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onTimeChange={handleTimeChange}
        />
      )}
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={true}
        layers={layers}
        className={styles.mapContainer}
      >
        <Map
          mapStyle="mapbox://styles/mapbox/dark-v10"
          mapboxApiAccessToken={MAPBOX_TOKEN}
        />
      </DeckGL>
      {tooltipInfo && (
        <div
          style={{
            left: tooltipInfo.x,
            top: tooltipInfo.y,
          }}
          className={styles.tooltip}
        >
          {tooltipInfo.text}
        </div>
      )}
    </div>
  );
};

export default WorldMap;
