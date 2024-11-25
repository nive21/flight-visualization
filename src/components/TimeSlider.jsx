const TimeSlider = ({
  startTime,
  endTime,
  currentTime,
  isPlaying,
  onPlayPause,
  onTimeChange,
}) => {
  // Convert timestamps to readable format

  return (
    <div style={{ zIndex: 3, position: "absolute" }}>
      <button onClick={onPlayPause}>{isPlaying ? "Pause" : "Play"}</button>
      <input
        type="range"
        min={startTime}
        max={endTime}
        value={currentTime}
        onChange={onTimeChange}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "whitesmoke",
        }}
      >
        <span>24 hours ago</span>
        <span>Now</span>
      </div>
    </div>
  );
};

export default TimeSlider;
