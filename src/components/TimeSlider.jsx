import styles from "../styles/Map.module.scss";
import playIcon from "../assets/play.svg";
import pauseIcon from "../assets/pause.svg";

const TimeSlider = ({
  startTime,
  endTime,
  currentTime,
  isPlaying,
  onPlayPause,
  onTimeChange,
}) => {
  return (
    <div className={styles.timeSlider}>
      <button onClick={onPlayPause}>
        {isPlaying ? (
          <img src={pauseIcon} alt="pause" />
        ) : (
          <img src={playIcon} alt="play" />
        )}
      </button>
      <input
        type="range"
        min={startTime}
        max={endTime}
        value={currentTime}
        onChange={onTimeChange}
      />
    </div>
  );
};

export default TimeSlider;
