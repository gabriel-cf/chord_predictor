const get_file_frequencies = (filepaths, n_frames, interval_time_ms) => {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const bufferLoader = new BufferLoader(
    context,
    filepaths,
    bufferLoader => correlation_worker_call(context, bufferLoader, n_frames, interval_time_ms));
  bufferLoader.load();
};

const interpret_correlation_result = (event) => {
  var frequency_amplitudes = event.data.frequency_amplitudes;

  // Compute the (squared) magnitudes of the complex amplitudes for each
  // test frequency.
  var magnitudes = frequency_amplitudes.map(function(z) { return z[0] * z[0] + z[1] * z[1]; });

  // Find the maximum in the list of magnitudes.
  var maximum_index = -1;
  var maximum_magnitude = 0;
  for (var i = 0; i < magnitudes.length; i++)
  {
    if (magnitudes[i] <= maximum_magnitude)
      continue;

    maximum_index = i;
    maximum_magnitude = magnitudes[i];
  }

  if (maximum_index === -1) {
    return;
  }

  // Compute the average magnitude. We'll only pay attention to frequencies
  // with magnitudes significantly above average.
  var average = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
  var dominant_frequency = test_frequencies[maximum_index];
  document.getElementById("note-name").textContent = dominant_frequency.name;
  document.getElementById("frequency").textContent = dominant_frequency.frequency;
}

const get_correlation_worker_postMessage = (timeseries, test_frequencies, sample_rate) => {
  return {
    "timeseries": timeseries,
    "test_frequencies": test_frequencies,
    "sample_rate": sample_rate
  };
};

const correlation_worker_call = (context, bufferLoader, n_frames, interval_frequency_in_ms) => {
  if (bufferLoader.length === 0) {
    return;
  }
  if (!n_frames) {
    n_frames = DEFAULT_N_FRAMES;
  }
  if (!interval_frequency_in_ms) {
    interval_frequency_in_ms = DEFAULT_INTERVAL_TIME_MS;
  }
  let source1 = context.createBufferSource();
  source1.buffer = bufferLoader[0];
  source1.connect(context.destination);
  source1.start(0);
  const duration = bufferLoader[0].duration;
  const buffer = source1.buffer.getChannelData(0);
  let i = 0;
  let minIndex = 0;
  let maxIndex = 0;
  const interval = setInterval(function () {
    minIndex = maxIndex;
    maxIndex = i * Math.ceil(source1.buffer.length / n_frames);
    if (maxIndex >= source1.buffer.length) {
      clearInterval(interval);
    }
    console.log(`${minIndex} - ${maxIndex}`);
    correlation_worker.postMessage(get_correlation_worker_postMessage(buffer.slice(minIndex, maxIndex),
                                                                       test_frequencies,
                                                                       context.sampleRate));
    ++i;
  }, interval_frequency_in_ms);
  bufferLoader.pop();
  correlation_worker_call(context, bufferLoader, n_frames, interval_frequency_in_ms);
}

/**
* MAIN
*/
const C2 = 65.41; // C2 note, in Hz.
const notes = [ "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" ];
let test_frequencies = [];
for (let i = 0; i < 30; i++) {
  const note_frequency = C2 * Math.pow(2, i / 12);
  const note_name = notes[i % 12];
  const note = { "frequency": note_frequency, "name": note_name };
  const just_above = { "frequency": note_frequency * Math.pow(2, 1 / 48), "name": note_name + " (a bit sharp)" };
  const just_below = { "frequency": note_frequency * Math.pow(2, -1 / 48), "name": note_name + " (a bit flat)" };
  test_frequencies = test_frequencies.concat([ just_below, note, just_above ]);
}

const DEFAULT_N_FRAMES = 10;
const DEFAULT_INTERVAL_TIME_MS = 100;

const audio_files = [
  './sounds/e-open.wav',
  './sounds/b-open.wav',
  './sounds/d-open.wav'
];

window.addEventListener("load", get_file_frequencies(audio_files));

const correlation_worker = new Worker("correlation_worker.js");
correlation_worker.addEventListener("message", interpret_correlation_result);
