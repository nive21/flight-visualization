import { useEffect, useState } from "react";
import { ArcLayer, ScatterplotLayer } from "@deck.gl/layers";
import airportCoordinates from "./data/airports";
import { Map } from "react-map-gl";
import DeckGL from "@deck.gl/react";
import { rawFlightData } from "./flightData";

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

const getLocationLayer = (validFlights, color, type) => ({
  id: "dep-layer",
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

const WorldMap = () => {
  const [layers, setLayers] = useState([]);
  const [tooltipInfo, setTooltipInfo] = useState(null);

  const tooltip = {
    highlightColor: [255, 255, 0, 128],
    onHover: ({ object, x, y }) => {
      const tooltip = object
        ? `${object.departure.airport} → ${object.arrival.airport}`
        : null;
      setTooltipInfo(tooltip ? { text: tooltip, x, y } : null);
    },
  };

  useEffect(() => {
    // Filter out flights with missing coordinates
    const validFlights = rawFlightData.data.filter((flight) => {
      const dep = airportCoordinates[flight.departure.icao];
      const arr = airportCoordinates[flight.arrival.icao];
      return dep && arr;
    });

    console.log("validFlights", validFlights);

    // Create ScatterplotLayer for departure airports
    const depLayer = new ScatterplotLayer({
      ...getLocationLayer(validFlights, ACCENT_COLOR_1, "departure"),
      ...tooltip,
    });

    // Create ScatterplotLayer for arrival airports
    const arrLayer = new ScatterplotLayer({
      ...getLocationLayer(validFlights, ACCENT_COLOR_2, "arrival"),
      ...tooltip,
    });

    // Create ArcLayer
    const arcLayer = new ArcLayer({
      id: "arc-layer",
      data: validFlights,
      pickable: true,
      getSourcePosition: (d) => {
        const departure = airportCoordinates[d.departure.icao];
        return [departure.longitude, departure.latitude];
      },
      getTargetPosition: (d) => {
        const arrival = airportCoordinates[d.arrival.icao];
        return [arrival.longitude, arrival.latitude];
      },
      getSourceColor: ACCENT_COLOR_1,
      getTargetColor: ACCENT_COLOR_2,
      getWidth: 2,
      autoHighlight: true,
      opacity: 0.8,
      fadeTrail: false,
      ...tooltip,
    });

    setLayers([arcLayer, depLayer, arrLayer]);
  }, []);

  return (
    <div>
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
