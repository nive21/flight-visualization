export const rawFlightData = {
  pagination: {},
  data: [
    {
      flight_date: "2024-11-18",
      flight_status: "active",
      departure: {
        airport: "John F. Kennedy International Airport",
        timezone: "America/New_York",
        iata: "JFK",
        icao: "KJFK",
        terminal: "4",
        gate: "B22",
        delay: null,
        scheduled: "2024-11-18T01:30:00+00:00", // Departure time before currentTime
        estimated: "2024-11-18T01:30:00+00:00",
        actual: "2024-11-18T01:35:00+00:00",
        estimated_runway: null,
        actual_runway: null,
      },
      arrival: {
        airport: "Los Angeles International Airport",
        timezone: "America/Los_Angeles",
        iata: "LAX",
        icao: "KLAX",
        terminal: "5",
        gate: "55A",
        baggage: "3",
        delay: null,
        scheduled: "2024-11-18T05:30:00+00:00", // Arrival time after currentTime
        estimated: "2024-11-18T05:30:00+00:00",
        actual: null,
        estimated_runway: null,
        actual_runway: null,
      },
      airline: {
        name: "Delta Air Lines",
        iata: "DL",
        icao: "DAL",
      },
      flight: {
        number: "445",
        iata: "DL445",
        icao: "DAL445",
        codeshared: null,
      },
      aircraft: {
        registration: "N12345",
        iata: "A320",
        icao: "A320",
        icao24: "A00001",
      },
      live: null,
    },
    {
      flight_date: "2024-11-18",
      flight_status: "active",
      departure: {
        airport: "Heathrow Airport",
        timezone: "Europe/London",
        iata: "LHR",
        icao: "EGLL",
        terminal: "3",
        gate: "22",
        delay: null,
        scheduled: "2024-11-18T01:00:00+00:00",
        estimated: "2024-11-18T01:00:00+00:00",
        actual: "2024-11-18T01:05:00+00:00",
        estimated_runway: null,
        actual_runway: null,
      },
      arrival: {
        airport: "Dubai International Airport",
        timezone: "Asia/Dubai",
        iata: "DXB",
        icao: "OMDB",
        terminal: "1",
        gate: "A3",
        baggage: null,
        delay: null,
        scheduled: "2024-11-18T09:00:00+00:00",
        estimated: "2024-11-18T09:00:00+00:00",
        actual: null,
        estimated_runway: null,
        actual_runway: null,
      },
      airline: {
        name: "Emirates",
        iata: "EK",
        icao: "UAE",
      },
      flight: {
        number: "30",
        iata: "EK30",
        icao: "UAE30",
        codeshared: null,
      },
      aircraft: {
        registration: "A6-EDA",
        iata: "A388",
        icao: "A388",
        icao24: "8963D9",
      },
      live: null,
    },
    {
      flight_date: "2024-11-18",
      flight_status: "scheduled",
      departure: {
        airport: "Tokyo Haneda Airport",
        timezone: "Asia/Tokyo",
        iata: "HND",
        icao: "RJTT",
        terminal: "2",
        gate: "D5",
        delay: null,
        scheduled: "2024-11-18T04:00:00+00:00", // Departure time after currentTime
        estimated: "2024-11-18T04:00:00+00:00",
        actual: null,
        estimated_runway: null,
        actual_runway: null,
      },
      arrival: {
        airport: "Sydney Kingsford Smith",
        timezone: "Australia/Sydney",
        iata: "SYD",
        icao: "YSSY",
        terminal: "1",
        gate: "32",
        baggage: null,
        delay: null,
        scheduled: "2024-11-18T14:00:00+00:00",
        estimated: "2024-11-18T14:00:00+00:00",
        actual: null,
        estimated_runway: null,
        actual_runway: null,
      },
      airline: {
        name: "Japan Airlines",
        iata: "JL",
        icao: "JAL",
      },
      flight: {
        number: "771",
        iata: "JL771",
        icao: "JAL771",
        codeshared: null,
      },
      aircraft: {
        registration: "JA825J",
        iata: "B788",
        icao: "B788",
        icao24: "848010",
      },
      live: null,
    },
  ],
};
