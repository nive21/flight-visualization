import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const Map = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    // Initialize Mapbox with globe and terrain
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12", // Realistic satellite style
      center: [0, 20], // Center the map [longitude, latitude]
      zoom: 2, // Initial zoom level
      pitch: 45, // Tilt the map for 3D effect
      bearing: 0,
      antialias: true, // For smoother 3D rendering
    });

    // Add the 3D terrain layer
    map.current.on("load", () => {
      map.current.setTerrain({
        source: "mapbox-dem", // Digital Elevation Model for terrain
        exaggeration: 1.5, // Terrain height exaggeration
      });

      // Add DEM source
      map.current.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.terrain-rgb",
        tileSize: 512,
        maxzoom: 50,
      });

      // Fetch flight data and visualize
      fetchFlightData();
    });
  }, []);

  const fetchFlightData = async () => {
    try {
      const response = await axios.get(
        "https://opensky-network.org/api/states/all"
      );
      const flights = response.data.states;

      // Convert flight data to GeoJSON
      const flightPaths = {
        type: "FeatureCollection",
        features: flights
          .filter((flight) => flight[5] && flight[6] && flight[9] && flight[10]) // Ensure valid coordinates
          .map((flight) => ({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [flight[5], flight[6]], // Start [longitude, latitude]
                [flight[9], flight[10]], // End [longitude, latitude]
              ],
            },
            properties: {
              callsign: flight[1], // Add callsign or other flight data
            },
          })),
      };

      // Add flight paths to the map
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
          "line-opacity": 0.8,
        },
      });
    } catch (error) {
      console.error("Error fetching flight data:", error);
    }
  };

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
};

export default Map;
