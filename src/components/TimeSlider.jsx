const TimeSlider = ({
  startTime,
  endTime,
  currentTime,
  isPlaying,
  onPlayPause,
  onTimeChange,
}) => {
  // Convert timestamps to readable format
  const formatTime = (timestamp) => new Date(timestamp * 1000).toLocaleString();

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
      <div>
        <span>{formatTime(startTime)}</span>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(endTime)}</span>
      </div>
    </div>
  );
};

export default TimeSlider;
