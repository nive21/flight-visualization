import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Get today's date in UTC for reference
    const now = new Date();
    const flightDate = `${now.getUTCFullYear()}-${String(
      now.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    // Fetch the latest 100 diverted flights from AviationStack
    const apiResponse = await fetch(
      `https://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATION_STACK_ACCESS_KEY}&flight_status=diverted&limit=100`
    );

    if (!apiResponse.ok)
      throw new Error("Failed to fetch AviationStack API data");
    const apiData = await apiResponse.json();

    // Save the data to Supabase
    const { error } = await supabase.from("diverted_flights").upsert(
      {
        flight_date: flightDate,
        data: apiData.data,
      },
      { onConflict: "flight_date" } // Avoid duplicate entries
    );

    if (error) throw error;

    res
      .status(200)
      .json({ message: `Data for ${flightDate} saved successfully.` });
  } catch (error) {
    console.error("Error fetching and saving flight data:", error);
    res.status(500).json({ error: error.message });
  }
}
